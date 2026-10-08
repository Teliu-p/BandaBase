-- BandaBase: restringir la función de restauración al rol autenticado
revoke execute on function public.restore_band_change(uuid) from public, anon;
grant execute on function public.restore_band_change(uuid) to authenticated;
