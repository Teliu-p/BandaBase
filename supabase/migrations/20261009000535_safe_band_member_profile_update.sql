-- Keep the owner lookup outside band_members RLS to avoid recursion.
create or replace function private.is_band_owner(p_band_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.band_members bm
    where bm.band_id = p_band_id
      and bm.user_id = (select auth.uid())
      and bm.active = true
      and bm.role = 'owner'
  );
$function$;

revoke all on function private.is_band_owner(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_band_owner(uuid) to authenticated;

drop policy if exists band_members_update_owner on public.band_members;
create policy band_members_update_owner
on public.band_members
for update
to authenticated
using (
  user_id <> (select auth.uid())
  and private.is_band_owner(band_id)
)
with check (
  role = any (array['member'::text, 'admin'::text])
);

-- The profile editor may update display_name; the owner panel may update role.
-- Do not leave table-level UPDATE grants that would permit arbitrary columns.
revoke update on table public.band_members from authenticated;
grant update (display_name, role) on table public.band_members to authenticated;

drop policy if exists band_members_update_self_profile on public.band_members;
create policy band_members_update_self_profile
on public.band_members
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- RLS policies cannot compare OLD and NEW values, so enforce that a user
-- editing their own membership can only change display_name.
create or replace function private.guard_band_member_self_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if (select auth.uid()) = old.user_id then
    if new.id is distinct from old.id
       or new.band_id is distinct from old.band_id
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.created_at is distinct from old.created_at
       or new.tags is distinct from old.tags then
      raise exception 'Solo podés modificar tu nombre desde tu perfil';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_band_member_self_update() from public, anon, authenticated;
drop trigger if exists guard_band_member_self_update on public.band_members;
create trigger guard_band_member_self_update
before update on public.band_members
for each row execute function private.guard_band_member_self_update();

-- Remove temporary public RPCs from the preceding hotfix.
drop function if exists public.update_my_band_member_display_name(uuid, text);
drop function if exists public.is_band_owner(uuid);
