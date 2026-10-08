-- Harden proposal vote replacement and align yes/no with the existing option model.

create or replace function public.validate_proposal_vote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_type text;
  v_option_exists boolean;
  v_count integer;
begin
  select voting_type into v_type
  from public.proposals
  where id = new.proposal_id and deleted_at is null;

  if not found then
    raise exception 'La propuesta no existe o fue eliminada';
  end if;

  if v_type in ('yes_no', 'single', 'multiple', 'Si/No', 'Una opción', 'Varias opciones') then
    if new.option_id is null then
      raise exception 'Esta votación requiere una opción';
    end if;

    select exists (
      select 1
      from public.proposal_options o
      where o.id = new.option_id
        and o.proposal_id = new.proposal_id
    ) into v_option_exists;

    if not v_option_exists then
      raise exception 'La opción no pertenece a la propuesta';
    end if;

    if v_type in ('yes_no', 'single', 'Si/No', 'Una opción') then
      select count(*) into v_count
      from public.proposal_votes v
      where v.proposal_id = new.proposal_id
        and v.user_id = new.user_id
        and v.id is distinct from new.id;

      if v_count >= 1 then
        raise exception 'Esta votación permite una sola opción';
      end if;
    end if;
  else
    raise exception 'Tipo de votación no soportado';
  end if;

  return new;
end;
$$;

create or replace function public.replace_my_proposal_votes(
  p_proposal_id uuid,
  p_option_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_band_id uuid;
  v_type text;
  v_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select band_id, voting_type
  into v_band_id, v_type
  from public.proposals
  where id = p_proposal_id
    and deleted_at is null
    and status = 'Abierta';

  if not found then
    raise exception 'La propuesta no está disponible para votar';
  end if;

  if not public.is_band_member(v_band_id) then
    raise exception 'No pertenecés a la banda de esta propuesta';
  end if;

  v_ids := coalesce(p_option_ids, '{}'::uuid[]);

  if cardinality(v_ids) = 0 then
    delete from public.proposal_votes
    where proposal_id = p_proposal_id
      and user_id = v_user_id;
    return;
  end if;

  if v_type in ('yes_no', 'single', 'Si/No', 'Una opción')
     and cardinality(v_ids) <> 1 then
    raise exception 'Esta votación permite una sola opción';
  end if;

  if v_type in ('multiple', 'Varias opciones') then
    v_ids := array(
      select distinct x
      from unnest(v_ids) as t(x)
    );
  end if;

  if exists (
    select 1
    from unnest(v_ids) as t(x)
    where not exists (
      select 1
      from public.proposal_options o
      where o.id = x
        and o.proposal_id = p_proposal_id
    )
  ) then
    raise exception 'Una o más opciones no pertenecen a la propuesta';
  end if;

  delete from public.proposal_votes
  where proposal_id = p_proposal_id
    and user_id = v_user_id;

  insert into public.proposal_votes (
    proposal_id,
    user_id,
    option_id
  )
  select
    p_proposal_id,
    v_user_id,
    x
  from unnest(v_ids) as t(x);
end;
$$;

revoke execute on function public.replace_my_proposal_votes(uuid, uuid[]) from public, anon;
grant execute on function public.replace_my_proposal_votes(uuid, uuid[]) to authenticated;
