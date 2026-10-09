-- Fix the band_members UPDATE policy without recursively querying band_members
-- through RLS, and restore the required EXECUTE permission for the list
-- instrument-slot CHECK constraint.

create or replace function public.is_band_owner(p_band_id uuid)
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

revoke all on function public.is_band_owner(uuid) from public, anon;
grant execute on function public.is_band_owner(uuid) to authenticated;

drop policy if exists band_members_update_owner on public.band_members;
create policy band_members_update_owner
on public.band_members
for update
to authenticated
using (
  user_id <> (select auth.uid())
  and public.is_band_owner(band_id)
)
with check (
  role = any (array['member'::text, 'admin'::text])
);

-- The check constraint runs during UPDATE as well as INSERT, so the
-- authenticated client needs EXECUTE on this pure validation function.
grant execute on function public.is_valid_band_list_instrument_slots(jsonb)
to authenticated;

-- Profile edits may update only the caller's own display_name via this
-- narrow RPC. This avoids granting self-service UPDATE access to role,
-- active status, band membership, or other sensitive columns.
create or replace function public.update_my_band_member_display_name(
  p_band_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'No hay un usuario autenticado';
  end if;

  update public.band_members
  set display_name = nullif(btrim(p_display_name), '')
  where band_id = p_band_id
    and user_id = (select auth.uid())
    and active = true;

  if not found then
    raise exception 'No tenés acceso activo a esta banda';
  end if;
end;
$function$;

revoke all on function public.update_my_band_member_display_name(uuid, text)
from public, anon;
grant execute on function public.update_my_band_member_display_name(uuid, text)
to authenticated;
