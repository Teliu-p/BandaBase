drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists profiles_select_band_members on public.profiles;
create policy profiles_select_band_members on public.profiles
for select to authenticated
using (
  exists (
    select 1
    from public.band_members bm_me
    join public.band_members bm_target
      on bm_target.band_id = bm_me.band_id
    where bm_me.user_id = (select auth.uid())
      and bm_me.active = true
      and bm_target.user_id = profiles.user_id
      and bm_target.active = true
  )
);

drop policy if exists members_select_member on public.band_members;
create policy members_select_member on public.band_members
for select to authenticated
using (
  public.is_band_member(band_id)
  or user_id = (select auth.uid())
);

drop policy if exists band_list_items_delete_control_v4 on public.band_list_items;
create policy band_list_items_delete_control_v4 on public.band_list_items
for delete to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status in ('Anotado','Confirmado')
        )
      )
  )
);