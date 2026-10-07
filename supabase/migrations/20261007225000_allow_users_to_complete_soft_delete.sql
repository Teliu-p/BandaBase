drop policy if exists songs_select_active_or_admin on public.songs;
create policy songs_select_active_or_own_trash_or_admin
on public.songs
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
);

drop policy if exists band_lists_select_member_or_admin on public.band_lists;
create policy band_lists_select_active_or_own_trash_or_admin
on public.band_lists
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
);

drop policy if exists proposals_select_active_or_admin on public.proposals;
create policy proposals_select_active_or_own_trash_or_admin
on public.proposals
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
);

drop policy if exists comments_select_active_or_admin on public.comments;
create policy comments_select_active_or_own_trash_or_admin
on public.comments
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
);
