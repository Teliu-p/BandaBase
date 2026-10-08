-- Proposal votes always reference a concrete option in the current voting model.
drop index if exists public.proposal_votes_yes_no_single_unique_idx;
alter table public.proposal_votes
  alter column option_id set not null;
