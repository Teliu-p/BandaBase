-- Consolidate the overlapping UPDATE policies for band_list_items.
-- The legacy v2 policy is permissive and is OR-combined with the stricter policy,
-- allowing its broader WITH CHECK to bypass same-band song/member validation.
-- Keep administrator and list-creator access, but apply the integrity checks to them too.

drop policy if exists band_list_items_update_control_v2
  on public.band_list_items;

drop policy if exists band_list_items_update_control
  on public.band_list_items;

create policy band_list_items_update_control
on public.band_list_items
for update
to authenticated
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
          and band_list_items.status = 'Anotado'
        )
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        (
          (public.is_band_admin(l.band_id)
            or l.created_by = (select auth.uid()))
          and (
            band_list_items.song_id is null
            or exists (
              select 1
              from public.songs s
              where s.id = band_list_items.song_id
                and s.band_id = l.band_id
            )
          )
          and (
            band_list_items.member_user_id is null
            or exists (
              select 1
              from public.band_members bm
              where bm.band_id = l.band_id
                and bm.user_id = band_list_items.member_user_id
                and bm.active = true
            )
          )
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
          and cardinality(band_list_items.participation_instruments) > 0
          and band_list_items.participation_instruments
            <@ array['guitar', 'voice', 'keyboard', 'bass', 'drums']::text[]
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado', 'Confirmado')
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and (
                l.created_by = (select auth.uid())
                or m.user_id = (select auth.uid())
              )
          )
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = band_list_items.member_user_id
              and bm.active = true
          )
        )
      )
  )
);
