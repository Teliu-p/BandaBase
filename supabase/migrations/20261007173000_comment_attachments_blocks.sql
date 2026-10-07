create table if not exists public.comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  kind text not null check (kind in ('file','link')),
  name text not null,
  file_name text,
  storage_path text,
  url text,
  mime_type text,
  file_size bigint,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_attachments_file_or_link_chk check (
    (kind = 'file' and storage_path is not null and url is null)
    or
    (kind = 'link' and url is not null and storage_path is null)
  )
);

create index if not exists comment_attachments_comment_id_idx
  on public.comment_attachments(comment_id);

create index if not exists comment_attachments_band_id_idx
  on public.comment_attachments(band_id);

create table if not exists public.comment_blocks (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  block_type text not null check (block_type in ('text','attachment')),
  content text,
  attachment_id uuid references public.comment_attachments(id) on delete set null,
  position integer not null,
  created_at timestamptz not null default now()
);

create index if not exists comment_blocks_comment_position_idx
  on public.comment_blocks(comment_id, position);

create index if not exists comment_blocks_attachment_id_idx
  on public.comment_blocks(attachment_id);

alter table public.comment_attachments enable row level security;
alter table public.comment_blocks enable row level security;

create policy comment_attachments_band_access
on public.comment_attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.band_id = comment_attachments.band_id
      and is_band_member(c.band_id)
  )
)
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.band_id = comment_attachments.band_id
      and is_band_member(c.band_id)
  )
);

create policy comment_blocks_band_access
on public.comment_blocks
for all
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and is_band_member(c.band_id)
  )
)
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and is_band_member(c.band_id)
  )
);
