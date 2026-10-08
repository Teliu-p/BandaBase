create or replace function public.trg_auto_confirm_band_list_items()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  perform public.auto_confirm_band_list_members(coalesce(new.list_id, old.list_id));
  return coalesce(new, old);
end;
$$;

revoke execute on function public.trg_auto_confirm_band_list_items() from public;

create or replace function public.trg_auto_confirm_band_list()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  perform public.auto_confirm_band_list_members(new.id);
  return new;
end;
$$;

revoke execute on function public.trg_auto_confirm_band_list() from public;

drop trigger if exists band_list_items_auto_confirm on public.band_list_items;
create trigger band_list_items_auto_confirm
after insert or update of status, participation_instruments, list_id or delete
on public.band_list_items for each row
execute function public.trg_auto_confirm_band_list_items();

drop trigger if exists band_lists_auto_confirm on public.band_lists;
create trigger band_lists_auto_confirm
after update of instrument_slots
on public.band_lists for each row
execute function public.trg_auto_confirm_band_list();

update public.band_list_items i
set participation_instruments = p.instruments
from public.profiles p
where i.item_type = 'member'
  and cardinality(i.participation_instruments) = 0
  and i.member_user_id = p.user_id
  and cardinality(p.instruments) > 0;

update public.band_lists
set instrument_slots = jsonb_build_object('guitar',2,'voice',2,'keyboard',1,'bass',1,'drums',1)
where instrument_slots = '{}'::jsonb and deleted_at is null;
revoke execute on function public.auto_confirm_band_list_members(uuid) from public;
drop function if exists public.trg_auto_confirm_band_list_members();
