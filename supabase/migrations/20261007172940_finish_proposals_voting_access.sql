alter table public.proposal_votes
  alter column vote drop not null;

grant select, insert, update, delete on public.proposal_options to authenticated;

create index if not exists proposals_band_created_idx
  on public.proposals(band_id, created_at desc);

create index if not exists proposal_votes_user_proposal_idx
  on public.proposal_votes(user_id, proposal_id);