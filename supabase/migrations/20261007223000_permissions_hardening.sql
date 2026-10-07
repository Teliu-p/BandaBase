create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.create_band(text) from public;
grant execute on function public.create_band(text) to authenticated;

revoke execute on function public.enter_bandabase() from public;
grant execute on function public.enter_bandabase() to authenticated;

revoke execute on function public.is_band_member(uuid) from public;
grant execute on function public.is_band_member(uuid) to authenticated;
