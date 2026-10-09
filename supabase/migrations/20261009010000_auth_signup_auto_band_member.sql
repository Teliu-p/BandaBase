-- Automatically add newly registered users to the only BandaBase band as regular members.
-- If more than one band exists, do not guess which band a new user should join.

create or replace function private.handle_new_auth_user_for_band()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_band_count integer;
  v_band_id uuid;
  v_display_name text;
begin
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  if v_display_name is null then
    v_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  insert into public.profiles (user_id, full_name)
  values (new.id, v_display_name)
  on conflict (user_id) do nothing;

  select count(*), min(id::text)::uuid
    into v_band_count, v_band_id
  from public.bands;

  if v_band_count = 1 then
    insert into public.band_members (
      band_id,
      user_id,
      role,
      active,
      display_name
    )
    values (
      v_band_id,
      new.id,
      'member',
      true,
      v_display_name
    )
    on conflict (band_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user_for_band() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_add_band_member on auth.users;

create trigger on_auth_user_created_add_band_member
after insert on auth.users
for each row
execute function private.handle_new_auth_user_for_band();
