drop policy if exists songs_update_member_or_admin on public.songs;
create policy songs_update_member_or_admin
on public.songs
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
  )
);

drop policy if exists band_lists_update_creator_or_admin on public.band_lists;
create policy band_lists_update_creator_or_admin
on public.band_lists
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
  )
);

drop policy if exists proposals_update_owner_or_admin on public.proposals;
create policy proposals_update_owner_or_admin
on public.proposals
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
  )
);

drop policy if exists comments_update_own_or_admin on public.comments;
create policy comments_update_own_or_admin
on public.comments
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    user_id = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    user_id = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or deleted_by = (select auth.uid())
  )
);
