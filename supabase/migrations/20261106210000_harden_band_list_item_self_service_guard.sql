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

    if new.status not in ('Anotado', 'Confirmado') then
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

      -- The SECURITY DEFINER auto-confirmation function marks only its internal
      -- status update. It may not change instruments or any other row field.
      if new.status = 'Confirmado'
         and current_setting('bandabase.auto_confirming_list_items', true) = 'on'
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

    if new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    return new;
  end if;

  return new;
end;
$function$;

-- Preserve the existing capacity calculation and row lock. Add a transaction-
-- local marker around the trusted status update so the guard above can distinguish
-- automatic confirmation from a direct client attempt.
create or replace function public.auto_confirm_band_list_members(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_slots jsonb;
  v_ok boolean := true;
  v_instrument text;
  v_confirmed integer;
  v_annotated integer;
  v_limit integer;
  v_previous_marker text;
begin
  select instrument_slots into v_slots
  from public.band_lists
  where id = p_list_id and deleted_at is null
  for update;

  if not found or v_slots is null or v_slots = '{}'::jsonb then
    return;
  end if;

  for v_instrument in
    select distinct x.instrument
    from public.band_list_items i
    cross join lateral unnest(i.participation_instruments) as x(instrument)
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status in ('Anotado', 'Confirmado')
  loop
    select count(*) into v_confirmed
    from public.band_list_items i
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status = 'Confirmado'
      and v_instrument = any(i.participation_instruments);

    select count(*) into v_annotated
    from public.band_list_items i
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status = 'Anotado'
      and v_instrument = any(i.participation_instruments);

    v_limit := coalesce((v_slots ->> v_instrument)::integer, 0);

    if v_confirmed + v_annotated > v_limit then
      v_ok := false;
      exit;
    end if;
  end loop;

  if v_ok then
    v_previous_marker := current_setting('bandabase.auto_confirming_list_items', true);
    perform set_config('bandabase.auto_confirming_list_items', 'on', true);

    begin
      update public.band_list_items
      set status = 'Confirmado'
      where list_id = p_list_id
        and item_type = 'member'
        and status = 'Anotado'
        and cardinality(participation_instruments) > 0;
    exception
      when others then
        perform set_config(
          'bandabase.auto_confirming_list_items',
          coalesce(v_previous_marker, ''),
          true
        );
        raise;
    end;

    perform set_config(
      'bandabase.auto_confirming_list_items',
      coalesce(v_previous_marker, ''),
      true
    );
  end if;
end;
$function$;
