
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_band_created_at_idx
  on public.comments(band_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments_band_select"
  on public.comments
  as permissive
  for select
  to authenticated
  using (public.is_band_member(band_id));

create policy "comments_member_insert"
  on public.comments
  as permissive
  for insert
  to authenticated
  with check (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
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
  );

create policy "comments_member_delete_own"
  on public.comments
  as permissive
  for delete
  to authenticated
  using (
    public.is_band_member(band_id)
    and user_id = (select auth.uid())
  );
