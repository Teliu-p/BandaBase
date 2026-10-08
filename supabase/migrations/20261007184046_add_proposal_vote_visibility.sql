
    alter table public.proposals
      add column if not exists voting_visibility text
        not null
        default 'public';

    alter table public.proposals
      drop constraint if exists proposals_voting_visibility_check;

    alter table public.proposals
      add constraint proposals_voting_visibility_check
      check (voting_visibility in ('public', 'anonymous'));
  