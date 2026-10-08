alter table public.profiles
  add column if not exists instruments text[] not null default '{}';

alter table public.band_lists
  add column if not exists instrument_slots jsonb not null default '{}'::jsonb;

alter table public.band_list_items
  add column if not exists participation_instruments text[] not null default '{}';

update public.profiles
set instruments = array_remove(
  array[
    case when lower(coalesce(instrument,'')) like '%guit%' then 'guitar' end,
    case when lower(coalesce(instrument,'')) like '%voz%' or lower(coalesce(instrument,'')) like '%cant%' then 'voice' end,
    case when lower(coalesce(instrument,'')) like '%tecl%' or lower(coalesce(instrument,'')) like '%piano%' then 'keyboard' end,
    case when lower(coalesce(instrument,'')) like '%baj%' then 'bass' end,
    case when lower(coalesce(instrument,'')) like '%bater%' or lower(coalesce(instrument,'')) like '%drum%' then 'drums' end
  ], null
)
where cardinality(instruments) = 0 and instrument is not null;

alter table public.profiles drop constraint if exists profiles_instruments_check;
alter table public.profiles add constraint profiles_instruments_check
  check (instruments <@ array['guitar','voice','keyboard','bass','drums']::text[]);

alter table public.band_list_items drop constraint if exists band_list_items_participation_instruments_check;
alter table public.band_list_items add constraint band_list_items_participation_instruments_check
  check (participation_instruments <@ array['guitar','voice','keyboard','bass','drums']::text[]);

alter table public.band_lists drop constraint if exists band_lists_instrument_slots_check;
alter table public.band_lists add constraint band_lists_instrument_slots_check
  check (jsonb_typeof(instrument_slots) = 'object');

create or replace function public.auto_confirm_band_list_members(p_list_id uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_slots jsonb;
  v_ok boolean := true;
  v_instrument text;
  v_count integer;
  v_limit integer;
begin
  select instrument_slots into v_slots from public.band_lists
  where id = p_list_id and deleted_at is null;
  if not found or v_slots is null or v_slots = '{}'::jsonb then return; end if;

  for v_instrument in
    select distinct x.instrument
    from public.band_list_items i
    cross join lateral unnest(i.participation_instruments) as x(instrument)
    where i.list_id = p_list_id and i.item_type = 'member' and i.status = 'Anotado'
  loop
    select count(*) into v_count from public.band_list_items i
    where i.list_id = p_list_id and i.item_type = 'member' and i.status = 'Anotado'
      and v_instrument = any(i.participation_instruments);
    v_limit := coalesce((v_slots ->> v_instrument)::integer, 0);
    if v_count > v_limit then v_ok := false; exit; end if;
  end loop;

  if v_ok then
    update public.band_list_items set status = 'Confirmado'
    where list_id = p_list_id and item_type = 'member' and status = 'Anotado'
      and cardinality(participation_instruments) > 0;
  end if;
end;
$$;

revoke execute on function public.auto_confirm_band_list_members(uuid) from anon, authenticated;

create or replace function public.trg_auto_confirm_band_list_members()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  perform public.auto_confirm_band_list_members(coalesce(new.list_id, old.list_id));
  return coalesce(new, old);
end;
$$;

revoke execute on function public.trg_auto_confirm_band_list_members() from anon, authenticated;

drop trigger if exists band_list_items_auto_confirm on public.band_list_items;
create trigger band_list_items_auto_confirm
after insert or update of status, participation_instruments, list_id or delete
on public.band_list_items for each row
execute function public.trg_auto_confirm_band_list_members();

drop trigger if exists band_lists_auto_confirm on public.band_lists;
create trigger band_lists_auto_confirm
after update of instrument_slots on public.band_lists for each row
execute function public.trg_auto_confirm_band_list_members();

drop policy if exists band_list_items_update_control on public.band_list_items;
create policy band_list_items_update_control on public.band_list_items
for update to authenticated
using (
  exists (select 1 from public.band_lists l where l.id = band_list_items.list_id
    and is_band_member(l.band_id)
    and (l.created_by = (select auth.uid())
      or (band_list_items.item_type = 'member' and band_list_items.member_user_id = (select auth.uid()) and band_list_items.status = 'Anotado')
      or (band_list_items.item_type = 'member' and exists (select 1 from public.band_list_managers m where m.list_id = l.id and m.user_id = (select auth.uid()))))
)
with check (
  exists (select 1 from public.band_lists l where l.id = band_list_items.list_id
    and is_band_member(l.band_id)
    and ((l.created_by = (select auth.uid())
      and (band_list_items.song_id is null or exists (select 1 from public.songs s where s.id = band_list_items.song_id and s.band_id = l.band_id))
      and (band_list_items.member_user_id is null or exists (select 1 from public.band_members bm where bm.band_id = l.band_id and bm.user_id = band_list_items.member_user_id and bm.active = true)))
      or (band_list_items.item_type = 'member' and band_list_items.member_user_id = (select auth.uid()) and band_list_items.status = 'Anotado' and cardinality(band_list_items.participation_instruments) > 0 and band_list_items.participation_instruments <@ array['guitar','voice','keyboard','bass','drums']::text[])
      or (band_list_items.item_type = 'member' and band_list_items.status in ('Anotado','Confirmado')
        and exists (select 1 from public.band_list_managers m where m.list_id = l.id and (l.created_by = (select auth.uid()) or m.user_id = (select auth.uid())))
        and exists (select 1 from public.band_members bm where bm.band_id = l.band_id and bm.user_id = band_list_items.member_user_id and bm.active = true))))
);
