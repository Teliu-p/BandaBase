-- Keep capacity trigger helpers internal; they are invoked by database triggers only.

revoke execute on function public.auto_confirm_band_list_members(uuid) from public, anon, authenticated;
revoke execute on function public.validate_band_list_participation_capacity() from public, anon, authenticated;
revoke execute on function public.trg_auto_confirm_band_list_items() from public, anon, authenticated;
revoke execute on function public.trg_auto_confirm_band_list() from public, anon, authenticated;
