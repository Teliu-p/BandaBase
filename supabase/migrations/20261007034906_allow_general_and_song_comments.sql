
drop policy if exists "comments_song_member_insert" on public.comments;
drop policy if exists "comments_song_member_update_own" on public.comments;

create policy "comments_member_insert"
  on public.comments
  as permissive
  for insert
  to authenticated
  with check (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
    and (
      song_id is null
      or exists (
        select 1
        from public.songs s
        where s.id = comments.song_id
          and s.band_id = comments.band_id
      )
    )
  );

create policy "comments_member_update_own"
  on public.comments
  as permissive
  for update
  to authenticated
  using (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
  )
  with check (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
    and (
      song_id is null
      or exists (
        select 1
        from public.songs s
        where s.id = comments.song_id
          and s.band_id = comments.band_id
      )
    )
  );
