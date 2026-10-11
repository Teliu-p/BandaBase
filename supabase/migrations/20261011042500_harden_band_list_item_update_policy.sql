-- Consolidate the overlapping UPDATE policies for band_list_items.
-- The legacy v2 policy is permissive and is OR-combined with the stricter policy,
-- allowing its broader WITH CHECK to bypass same-band song/member validation.
-- Keep administrator and list-creator access, but apply the integrity checks to them too.

-- Keep the RLS self-service path column-safe. WITH CHECK validates the final row,
-- but it cannot compare OLD and NEW values; without this guard a member could
-- also change title, position, or other fields while updating their instruments.
create or replace function private.prevent_manager_list_item_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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

  -- Non-manager members may change only their own instrument selection while
  -- their participation remains annotated. This also blocks row/list mutation
  -- attempts that would otherwise satisfy the broad self-service WITH CHECK.
  if old.member_user_id = (select auth.uid())
     and old.status = 'Anotado' then
    if (to_jsonb(new) - 'participation_instruments')
       is distinct from
       (to_jsonb(old) - 'participation_instruments') then
      raise exception 'Los integrantes solo pueden modificar sus instrumentos mientras están anotados.';
    end if;
  end if;

  return new;
end;
$function$;

drop policy if exists band_list_items_update_control_v2
  on public.band_list_items;

drop policy if exists band_list_items_update_control
  on public.band_list_items;

create policy band_list_items_update_control
on public.band_list_items
for update
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
        )
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        (
          (public.is_band_admin(l.band_id)
            or l.created_by = (select auth.uid()))
          and (
            band_list_items.song_id is null
            or exists (
              select 1
              from public.songs s
              where s.id = band_list_items.song_id
                and s.band_id = l.band_id
            )
          )
          and (
            band_list_items.member_user_id is null
            or exists (
              select 1
              from public.band_members bm
              where bm.band_id = l.band_id
                and bm.user_id = band_list_items.member_user_id
                and bm.active = true
            )
          )
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
          and cardinality(band_list_items.participation_instruments) > 0
          and band_list_items.participation_instruments
            <@ array['guitar', 'voice', 'keyboard', 'bass', 'drums']::text[]
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado', 'Confirmado')
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and (
                l.created_by = (select auth.uid())
                or m.user_id = (select auth.uid())
              )
          )
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = band_list_items.member_user_id
              and bm.active = true
          )
        )
      )
  )
);
