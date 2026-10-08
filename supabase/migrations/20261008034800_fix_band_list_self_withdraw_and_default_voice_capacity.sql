-- Finalize list participation semantics: status changes are manual decisions,
-- while annotations/functions/capacity changes can trigger automatic promotion.

drop trigger if exists band_list_items_auto_confirm on public.band_list_items;
create trigger band_list_items_auto_confirm
after insert or update of participation_instruments, list_id
on public.band_list_items
for each row execute function public.trg_auto_confirm_band_list_items();

drop trigger if exists band_lists_auto_confirm on public.band_lists;
create trigger band_lists_auto_confirm
after update of instrument_slots
on public.band_lists
for each row execute function public.trg_auto_confirm_band_list();

-- The canonical default is five vocalists.
update public.band_lists
set instrument_slots = jsonb_set(
  instrument_slots,
  '{voice}',
  '5'::jsonb,
  true
)
where deleted_at is null
  and instrument_slots = '{"bass":1,"drums":1,"voice":2,"guitar":2,"keyboard":1}'::jsonb;
