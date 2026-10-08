alter table public.band_lists
  drop column if exists event_type;

alter table public.band_lists
  drop constraint if exists band_lists_status_check;

alter table public.band_lists
  add constraint band_lists_status_check
  check (status = any (array['Planificada'::text, 'Confirmada'::text]));

alter table public.band_list_items
  drop constraint if exists band_list_items_item_type_check;

alter table public.band_list_items
  add constraint band_list_items_item_type_check
  check (item_type = any (array['song'::text, 'member'::text]));