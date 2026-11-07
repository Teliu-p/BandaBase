-- Restrict self-service UPDATEs on band_list_items to the participant's
-- instrument selection. The current UPDATE RLS policy was already consolidated
-- by 20261020232312; this migration intentionally does not replace that policy.
--
-- A list manager who is also a participant retains the self-service instrument
-- picker for their own row. For other participants, managers may change status
-- only. List creators and band admins retain their existing broader permissions.

create or replace function private.prevent_manager_list_item_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_band_id uuid;
  v_user_id uuid := (select auth.uid());
  v_is_manager boolean := false;
begin
  if old.item_type <> 'member' then
    return new;
  end if;

  select l.band_id into v_band_id
  from public.band_lists l
  where l.id = old.list_id;

  if v_band_id is null
     or public.is_band_admin(v_band_id)
     or exists (
       select 1
       from public.band_lists l
       where l.id = old.list_id
         and l.created_by = v_user_id
     ) then
    return new;
  end if;

  select exists (
    select 1
    from public.band_list_managers m
    where m.list_id = old.list_id
      and m.user_id = v_user_id
  )
  into v_is_manager;

  -- Self-participation takes precedence over the manager branch. The UI allows
  -- a manager who is also participating to edit their own selected instruments.
  if old.member_user_id = v_user_id
     and old.status = 'Anotado' then
    if (to_jsonb(new) - array['participation_instruments', 'status'])
       is distinct from
       (to_jsonb(old) - array['participation_instruments', 'status']) then
      raise exception 'Solo podés modificar los instrumentos de tu propia participación.';
    end if;

    if new.status is null or new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    if new.participation_instruments is distinct from old.participation_instruments
       and cardinality(coalesce(new.participation_instruments, '{}'::text[])) = 0 then
      raise exception 'Elegí al menos una función para tu participación.';
    end if;

    if new.status is distinct from old.status then
      -- A manager may use the existing manager control to confirm their own row.
      if new.status = 'Confirmado' and v_is_manager then
        return new;
      end if;

      -- Automatic confirmation is issued by the existing AFTER trigger while
      -- that trigger is still on the call stack. Its nested UPDATE reaches this
      -- guard at depth > 1; a direct client UPDATE reaches it at depth 1.
      if new.status = 'Confirmado'
         and pg_trigger_depth() > 1
         and new.participation_instruments is not distinct from old.participation_instruments
         and (to_jsonb(new) - 'status') is not distinct from (to_jsonb(old) - 'status') then
        return new;
      end if;

      raise exception 'No podés confirmar tu propia participación directamente.';
    end if;

    return new;
  end if;

  -- A manager may change another participant's status, but no other column.
  -- Comparing the complete row prevents future columns from silently becoming
  -- editable when the table evolves.
  if v_is_manager then
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Los responsables solo pueden cambiar el estado de la participación.';
    end if;

    if new.status is null or new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    return new;
  end if;

  return new;
end;
$function$;
