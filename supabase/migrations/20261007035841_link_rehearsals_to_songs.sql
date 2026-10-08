create table if not exists public.rehearsal_songs (
  id uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references public.rehearsals(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint rehearsal_songs_rehearsal_song_unique unique (rehearsal_id, song_id)
);

create index if not exists rehearsal_songs_rehearsal_id_idx
  on public.rehearsal_songs(rehearsal_id);

create index if not exists rehearsal_songs_song_id_idx
  on public.rehearsal_songs(song_id);

create index if not exists rehearsals_band_date_idx
  on public.rehearsals(band_id, rehearsal_date desc, rehearsal_time desc);

alter table public.rehearsal_songs enable row level security;

create policy "rehearsal_songs_band_access"
  on public.rehearsal_songs
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.rehearsals r
      where r.id = rehearsal_songs.rehearsal_id
        and public.is_band_member(r.band_id)
    )
    and exists (
      select 1
      from public.songs s
      join public.rehearsals r on r.band_id = s.band_id
      where s.id = rehearsal_songs.song_id
        and r.id = rehearsal_songs.rehearsal_id
        and public.is_band_member(r.band_id)
    )
  )
  with check (
    exists (
      select 1
      from public.rehearsals r
      where r.id = rehearsal_songs.rehearsal_id
        and public.is_band_member(r.band_id)
    )
    and exists (
      select 1
      from public.songs s
      join public.rehearsals r on r.band_id = s.band_id
      where s.id = rehearsal_songs.song_id
        and r.id = rehearsal_songs.rehearsal_id
        and public.is_band_member(r.band_id)
    )
  );