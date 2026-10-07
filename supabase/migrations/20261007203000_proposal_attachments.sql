create table if not exists public.proposal_attachments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  title text,
  file_name text,
  storage_path text,
  url text,
  mime_type text,
  file_size bigint,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.proposal_attachments enable row level security;

drop policy if exists "proposal_attachments_band_access"
on public.proposal_attachments;

create policy "proposal_attachments_band_access"
on public.proposal_attachments
for all
to authenticated
using (is_band_member(band_id))
with check (is_band_member(band_id));

create index if not exists proposal_attachments_proposal_id_idx
on public.proposal_attachments(proposal_id);