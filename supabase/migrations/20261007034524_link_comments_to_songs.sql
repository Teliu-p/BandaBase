alter table public.comments
  add column if not exists song_id uuid references public.songs(id) on delete cascade;

update public.comments
set song_id = null
where song_id is not null
  and not exists (
    select 1
    from public.songs s
    where s.id = public.comments.song_id
      and s.band_id = public.comments.band_id
  );

create index if not exists comments_song_created_at_idx
  on public.comments(song_id, created_at desc);

drop policy if exists "comments_band_select" on public.comments;
drop policy if exists "comments_member_insert" on public.comments;
drop policy if exists "comments_member_update_own" on public.comments;
drop policy if exists "comments_member_delete_own" on public.comments;

create policy "comments_song_select"
  on public.comments
  as permissive
  for select
  to authenticated
  using (
    public.is_band_member(band_id)
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

create policy "comments_song_member_insert"
  on public.comments
  as permissive
  for insert
  to authenticated
  with check (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
    and song_id is not null
    and exists (
      select 1
      from public.songs s
      where s.id = comments.song_id
        and s.band_id = comments.band_id
    )
  );

create policy "comments_song_member_update_own"
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
    and song_id is not null
    and exists (
      select 1
      from public.songs s
      where s.id = comments.song_id
        and s.band_id = comments.band_id
    )
  );

create policy "comments_song_member_delete_own"
  on public.comments
  as permissive
  for delete
  to authenticated
  using (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
  );