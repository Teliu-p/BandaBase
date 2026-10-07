create or replace function public.get_proposal_vote_stats(
  p_proposal_ids uuid[]
)
returns table (
  proposal_id uuid,
  option_id uuid,
  vote_count bigint,
  voter_count bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with scoped as (
    select pv.proposal_id, pv.option_id, pv.user_id
    from public.proposal_votes pv
    join public.proposals p
      on p.id = pv.proposal_id
    where pv.proposal_id = any(p_proposal_ids)
      and p.deleted_at is null
      and exists (
        select 1
        from public.band_members bm
        where bm.band_id = p.band_id
          and bm.user_id = (select auth.uid())
          and bm.active = true
      )
  ),
  option_counts as (
    select
      proposal_id,
      option_id,
      count(*)::bigint as vote_count
    from scoped
    group by proposal_id, option_id
  ),
  voter_counts as (
    select
      proposal_id,
      count(distinct user_id)::bigint as voter_count
    from scoped
    group by proposal_id
  )
  select
    oc.proposal_id,
    oc.option_id,
    oc.vote_count,
    vc.voter_count
  from option_counts oc
  join voter_counts vc
    on vc.proposal_id = oc.proposal_id
$$;

revoke all on function public.get_proposal_vote_stats(uuid[]) from public, anon;
grant execute on function public.get_proposal_vote_stats(uuid[]) to authenticated;

drop policy if exists proposal_votes_select_member on public.proposal_votes;

create policy proposal_votes_select_public_or_own
on public.proposal_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_votes.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
      and (
        p.voting_visibility = 'public'
        or proposal_votes.user_id = (select auth.uid())
      )
  )
);
