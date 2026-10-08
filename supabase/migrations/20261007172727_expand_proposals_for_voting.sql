
alter table public.proposals
  add column if not exists voting_type text not null default 'single'
    check (voting_type in ('yes_no','single','multiple'));

create table if not exists public.proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.proposal_votes
  add column if not exists option_id uuid references public.proposal_options(id) on delete cascade;

alter table public.proposal_options enable row level security;

drop policy if exists "proposal_options_band_access" on public.proposal_options;
create policy "proposal_options_band_access"
on public.proposal_options
for all
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_options.proposal_id
      and is_band_member(p.band_id)
  )
)
with check (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_options.proposal_id
      and is_band_member(p.band_id)
  )
);

create index if not exists proposal_options_proposal_position_idx
  on public.proposal_options(proposal_id, position);

create index if not exists proposal_votes_proposal_option_idx
  on public.proposal_votes(proposal_id, option_id);

create unique index if not exists proposal_votes_user_option_unique_idx
  on public.proposal_votes(proposal_id, user_id, option_id);

create unique index if not exists proposal_votes_yes_no_single_unique_idx
  on public.proposal_votes(proposal_id, user_id)
  where option_id is null;
