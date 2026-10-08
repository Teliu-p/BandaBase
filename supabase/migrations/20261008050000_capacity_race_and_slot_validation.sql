create or replace function public.is_valid_band_list_instrument_slots(p_slots jsonb)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $function$
declare
  item record;
  v_number numeric;
begin
  if jsonb_typeof(p_slots) <> 'object' then
    return false;
  end if;

  for item in
    select * from jsonb_each(p_slots)
  loop
    if item.key not in ('guitar', 'voice', 'keyboard', 'bass', 'drums')
       or jsonb_typeof(item.value) <> 'number' then
      return false;
    end if;

    v_number := item.value::numeric;

    if v_number < 0
       or v_number <> trunc(v_number)
       or v_number > 2147483647 then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

revoke all on function public.is_valid_band_list_instrument_slots(jsonb) from public, anon, authenticated;

create or replace function public.auto_confirm_band_list_members(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
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
  where id = p_list_id and deleted_at is null
  for update;

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
$function$;

create or replace function public.validate_band_list_participation_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
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
  where id = new.list_id and deleted_at is null
  for update;

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
$function$;

alter table public.band_lists
  drop constraint if exists band_lists_instrument_slots_check;

alter table public.band_lists
  add constraint band_lists_instrument_slots_check
  check (public.is_valid_band_list_instrument_slots(instrument_slots));