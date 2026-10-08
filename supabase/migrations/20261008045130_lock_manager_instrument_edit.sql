-- Managers may change participation status, but not the member's selected functions.

create or replace function private.prevent_manager_list_item_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_band_id uuid;
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
       select 1 from public.band_lists l
       where l.id = old.list_id
         and l.created_by = (select auth.uid())
     ) then
    return new;
  end if;

  if exists (
    select 1 from public.band_list_managers m
    where m.list_id = old.list_id
      and m.user_id = (select auth.uid())
  ) then
    if old.list_id is distinct from new.list_id
       or old.item_type is distinct from new.item_type
       or old.title is distinct from new.title
       or old.details is distinct from new.details
       or old.song_id is distinct from new.song_id
       or old.member_user_id is distinct from new.member_user_id
       or old.participation_instruments is distinct from new.participation_instruments
       or old.position is distinct from new.position
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Los responsables solo pueden cambiar la participación del integrante.';
    end if;

    if new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke execute on function private.prevent_manager_list_item_edit() from public, anon, authenticated;
