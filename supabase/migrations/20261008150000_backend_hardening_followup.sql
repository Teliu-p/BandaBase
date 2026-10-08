-- BandaBase backend hardening follow-up.
-- Keeps proposal votes compatible with multi-option voting, enforces list capacity,
-- and adds database-level shape/business constraints.

alter table public.proposal_votes
  drop constraint if exists proposal_votes_proposal_id_user_id_key;

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

  if v_type = 'Si/No' then
    if new.option_id is not null then
      raise exception 'Una votación Si/No no acepta una opción';
    end if;
  elsif v_type in ('Una opción', 'Varias opciones') then
    if new.option_id is null then
      raise exception 'Esta votación requiere una opción';
    end if;

    select exists (
      select 1 from public.proposal_options o
      where o.id = new.option_id and o.proposal_id = new.proposal_id
    ) into v_option_exists;

    if not v_option_exists then
      raise exception 'La opción no pertenece a la propuesta';
    end if;

    if v_type = 'Una opción' then
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

drop trigger if exists proposal_votes_validate on public.proposal_votes;
create trigger proposal_votes_validate
before insert or update of proposal_id, user_id, option_id
on public.proposal_votes
for each row execute function public.validate_proposal_vote();

revoke execute on function public.validate_proposal_vote() from public, anon, authenticated;

create or replace function public.auto_confirm_band_list_members(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_slots jsonb;
  v_ok boolean := true;
  v_instrument text;
  v_confirmed integer;
  v_annotated integer;
  v_limit integer;
begin
  select instrument_slots into v_slots
  from public.band_lists
  where id = p_list_id and deleted_at is null;

  if not found or v_slots is null or v_slots = '{}'::jsonb then
    return;
  end if;

  for v_instrument in
    select distinct x.instrument
    from public.band_list_items i
    cross join lateral unnest(i.participation_instruments) as x(instrument)
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status in ('Anotado', 'Confirmado')
  loop
    select count(*) into v_confirmed
    from public.band_list_items i
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status = 'Confirmado'
      and v_instrument = any(i.participation_instruments);

    select count(*) into v_annotated
    from public.band_list_items i
    where i.list_id = p_list_id
      and i.item_type = 'member'
      and i.status = 'Anotado'
      and v_instrument = any(i.participation_instruments);

    v_limit := coalesce((v_slots ->> v_instrument)::integer, 0);

    if v_confirmed + v_annotated > v_limit then
      v_ok := false;
      exit;
    end if;
  end loop;

  if v_ok then
    update public.band_list_items
    set status = 'Confirmado'
    where list_id = p_list_id
      and item_type = 'member'
      and status = 'Anotado'
      and cardinality(participation_instruments) > 0;
  end if;
end;
$$;

create or replace function public.validate_band_list_participation_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_slots jsonb;
  v_instrument text;
  v_confirmed integer;
  v_limit integer;
begin
  if new.item_type <> 'member'
     or new.status <> 'Confirmado'
     or coalesce(old.status, 'Anotado') = 'Confirmado' then
    return new;
  end if;

  if cardinality(coalesce(new.participation_instruments, '{}'::text[])) = 0 then
    raise exception 'No se puede marcar Participando sin seleccionar al menos una función';
  end if;

  select instrument_slots into v_slots
  from public.band_lists
  where id = new.list_id and deleted_at is null;

  if not found then
    raise exception 'La lista no existe o fue eliminada';
  end if;

  for v_instrument in select distinct unnest(new.participation_instruments)
  loop
    select count(*) into v_confirmed
    from public.band_list_items i
    where i.list_id = new.list_id
      and i.item_type = 'member'
      and i.status = 'Confirmado'
      and i.id <> new.id
      and v_instrument = any(i.participation_instruments);

    v_limit := coalesce((v_slots ->> v_instrument)::integer, 0);

    if v_confirmed + 1 > v_limit then
      raise exception 'No hay cupo disponible para %', v_instrument;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists band_list_items_validate_participation_capacity on public.band_list_items;
create trigger band_list_items_validate_participation_capacity
before update of status on public.band_list_items
for each row execute function public.validate_band_list_participation_capacity();

revoke execute on function public.validate_band_list_participation_capacity() from public, anon, authenticated;

alter table public.band_list_items
  drop constraint if exists band_list_items_shape_check;

alter table public.band_list_items
  add constraint band_list_items_shape_check check (
    (item_type='song' and song_id is not null and member_user_id is null and cardinality(coalesce(participation_instruments,'{}'::text[]))=0)
    or
    (item_type='member' and member_user_id is not null and song_id is null)
  );

alter table public.band_list_items
  drop constraint if exists band_list_items_member_status_check;

alter table public.band_list_items
  add constraint band_list_items_member_status_check check (
    item_type='song'
    or status in ('Anotado','Confirmado')
  );

alter table public.songs
  drop constraint if exists songs_bpm_positive_check;

alter table public.songs
  add constraint songs_bpm_positive_check check (
    (bpm is null or bpm between 1 and 400)
    and (original_bpm is null or original_bpm between 1 and 400)
    and (duration is null or duration > 0)
    and (original_duration is null or original_duration > 0)
  );
