alter table public.band_lists
  drop column if exists list_date,
  drop column if exists list_time;