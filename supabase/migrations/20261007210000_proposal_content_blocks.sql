create table if not exists public.proposal_blocks (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  block_type text not null check (block_type in ('text', 'attachment')),
  content text,
  attachment_id uuid references public.proposal_attachments(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.proposal_blocks enable row level security;

drop policy if exists "proposal_blocks_band_access"
on public.proposal_blocks;

create policy "proposal_blocks_band_access"
on public.proposal_blocks
for all
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_blocks.proposal_id
      and is_band_member(p.band_id)
  )
)
with check (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_blocks.proposal_id
      and is_band_member(p.band_id)
  )
);

create index if not exists proposal_blocks_proposal_position_idx
on public.proposal_blocks(proposal_id, position);

create index if not exists proposal_blocks_attachment_id_idx
on public.proposal_blocks(attachment_id);