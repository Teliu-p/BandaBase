\set ON_ERROR_STOP on

-- Manual validation against the FULL restored BandaBase database.
-- Run only against the local restore-lab container, never against production.
-- All DDL, seed rows, trigger effects, and audit writes are rolled back at the end.

begin;

create or replace function private.prevent_manager_list_item_edit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_band_id uuid;
  v_user_id uuid := (select auth.uid());
  v_is_manager boolean := false;
begin
  if old.item_type <> 'member' then
    return new;
  end if;

  select l.band_id into v_band_id
  from public.band_lists l
  where l.id = old.list_id;

  if v_band_id is null
     or public.is_band_admin(v_band_id)
     or exists (
       select 1
       from public.band_lists l
       where l.id = old.list_id
         and l.created_by = v_user_id
     ) then
    return new;
  end if;

  select exists (
    select 1
    from public.band_list_managers m
    where m.list_id = old.list_id
      and m.user_id = v_user_id
  )
  into v_is_manager;

  if old.member_user_id = v_user_id
     and old.status = 'Anotado' then
    if (to_jsonb(new) - array['participation_instruments', 'status'])
       is distinct from
       (to_jsonb(old) - array['participation_instruments', 'status']) then
      raise exception 'Solo podés modificar los instrumentos de tu propia participación.';
    end if;

    if new.status is null or new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    if new.participation_instruments is distinct from old.participation_instruments
       and cardinality(coalesce(new.participation_instruments, '{}'::text[])) = 0 then
      raise exception 'Elegí al menos una función para tu participación.';
    end if;

    if new.status is distinct from old.status then
      if new.status = 'Confirmado' and v_is_manager then
        return new;
      end if;

      if new.status = 'Confirmado'
         and pg_trigger_depth() > 1
         and new.participation_instruments is not distinct from old.participation_instruments
         and (to_jsonb(new) - 'status') is not distinct from (to_jsonb(old) - 'status') then
        return new;
      end if;

      raise exception 'No podés confirmar tu propia participación directamente.';
    end if;

    return new;
  end if;

  if v_is_manager then
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Los responsables solo pueden cambiar el estado de la participación.';
    end if;

    if new.status is null or new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    return new;
  end if;

  return new;
end;
$function$;

-- Prepare two temporary-in-transaction lists using the existing active owner
-- and two active members from the restored database.
do $prepare$
declare
  v_band_id uuid;
  v_owner uuid;
  v_members uuid[];
  v_user_a uuid;
  v_user_b uuid;
  v_list_a uuid := gen_random_uuid();
  v_list_b uuid := gen_random_uuid();
  v_item_a_participant uuid := gen_random_uuid();
  v_item_a_manager uuid := gen_random_uuid();
  v_item_b_manager uuid := gen_random_uuid();
  v_item_b_participant uuid := gen_random_uuid();
begin
  select bm.band_id
  into v_band_id
  from public.band_members bm
  group by bm.band_id
  having count(*) filter (where bm.active and bm.role = 'owner') >= 1
     and count(*) filter (where bm.active and bm.role = 'member') >= 2
  order by bm.band_id
  limit 1;

  if v_band_id is null then
    raise exception 'Restore validation needs one band with one active owner and two active members.';
  end if;

  select bm.user_id
  into v_owner
  from public.band_members bm
  where bm.band_id = v_band_id
    and bm.active
    and bm.role = 'owner'
  order by bm.created_at, bm.user_id
  limit 1;

  select array_agg(bm.user_id order by bm.created_at, bm.user_id)
  into v_members
  from public.band_members bm
  where bm.band_id = v_band_id
    and bm.active
    and bm.role = 'member';

  v_user_a := v_members[1];
  v_user_b := v_members[2];

  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  insert into public.band_lists (id, band_id, title, created_by, instrument_slots)
  values
    (v_list_a, v_band_id, '[restore-test] participant guard', v_owner,
     '{"guitar":1,"bass":1}'::jsonb),
    (v_list_b, v_band_id, '[restore-test] manager self-service', v_owner,
     '{"guitar":1,"bass":1}'::jsonb);

  insert into public.band_list_managers (list_id, user_id, created_by)
  values
    (v_list_a, v_user_b, v_owner),
    (v_list_b, v_user_a, v_owner);

  perform set_config('bandabase.skip_list_auto_confirm', 'on', true);

  insert into public.band_list_items
    (id, list_id, item_type, title, details, song_id, member_user_id,
     status, position, participation_instruments, created_by)
  values
    (v_item_a_participant, v_list_a, 'member', '[restore-test] participant A',
     null, null, v_user_a, 'Anotado', 0, array['guitar']::text[], v_owner),
    (v_item_a_manager, v_list_a, 'member', '[restore-test] manager B',
     null, null, v_user_b, 'Anotado', 1, array['bass']::text[], v_owner),
    (v_item_b_manager, v_list_b, 'member', '[restore-test] manager A',
     null, null, v_user_a, 'Anotado', 0, array['bass']::text[], v_owner),
    (v_item_b_participant, v_list_b, 'member', '[restore-test] participant B',
     null, null, v_user_b, 'Anotado', 1, array['guitar']::text[], v_owner);

  perform set_config('bandabase.skip_list_auto_confirm', 'off', true);

  perform set_config('bandabase.restore_test.owner', v_owner::text, true);
  perform set_config('bandabase.restore_test.user_a', v_user_a::text, true);
  perform set_config('bandabase.restore_test.user_b', v_user_b::text, true);
  perform set_config('bandabase.restore_test.list_a', v_list_a::text, true);
  perform set_config('bandabase.restore_test.item_a_participant', v_item_a_participant::text, true);
  perform set_config('bandabase.restore_test.item_a_manager', v_item_a_manager::text, true);
  perform set_config('bandabase.restore_test.item_b_manager', v_item_b_manager::text, true);
  perform set_config('bandabase.restore_test.item_b_participant', v_item_b_participant::text, true);
end;
$prepare$;

set local role authenticated;

do $test$
declare
  v_owner uuid := current_setting('bandabase.restore_test.owner')::uuid;
  v_user_a uuid := current_setting('bandabase.restore_test.user_a')::uuid;
  v_user_b uuid := current_setting('bandabase.restore_test.user_b')::uuid;
  v_item_a_participant uuid := current_setting('bandabase.restore_test.item_a_participant')::uuid;
  v_item_a_manager uuid := current_setting('bandabase.restore_test.item_a_manager')::uuid;
  v_item_b_manager uuid := current_setting('bandabase.restore_test.item_b_manager')::uuid;
  v_item_b_participant uuid := current_setting('bandabase.restore_test.item_b_participant')::uuid;
  v_affected integer;
  v_status text;
  v_instruments text[];
  v_caught boolean;
begin
  -- Normal participant: cannot edit their row title.
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_caught := false;
  begin
    update public.band_list_items
    set title = title || ' [unauthorized]'
    where id = v_item_a_participant;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: participant could edit their own title.';
  end if;

  -- Normal participant: cannot confirm themselves directly.
  v_caught := false;
  begin
    update public.band_list_items
    set status = 'Confirmado'
    where id = v_item_a_participant;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: participant could confirm themselves directly.';
  end if;

  -- A legitimate instrument update still launches the real nested
  -- auto-confirm trigger; the participant's own status transition must pass.
  update public.band_list_items
  set participation_instruments = array['guitar']::text[]
  where id = v_item_a_participant;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: participant instrument update was denied; affected=%', v_affected;
  end if;

  select status into v_status
  from public.band_list_items
  where id = v_item_a_participant;
  if v_status is distinct from 'Confirmado' then
    raise exception 'FAIL: nested auto-confirm did not confirm participant A; status=%', v_status;
  end if;

  select status into v_status
  from public.band_list_items
  where id = v_item_a_manager;
  if v_status is distinct from 'Confirmado' then
    raise exception 'FAIL: nested auto-confirm did not confirm manager B; status=%', v_status;
  end if;

  -- Manager B retains status control over another participant.
  perform set_config('request.jwt.claim.sub', v_user_b::text, true);
  update public.band_list_items
  set status = 'Anotado'
  where id = v_item_a_participant;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: manager could not demote another participant; affected=%', v_affected;
  end if;

  update public.band_list_items
  set status = 'Confirmado'
  where id = v_item_a_participant;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: manager could not confirm another participant; affected=%', v_affected;
  end if;

  -- Production status is nullable; the manager guard must reject NULL before
  -- the RLS WITH CHECK / table CHECK constraints are evaluated.
  v_caught := false;
  begin
    update public.band_list_items
    set status = null
    where id = v_item_a_participant;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: manager could clear another participant status.';
  end if;

  -- Manager cannot edit another participant's other fields.
  v_caught := false;
  begin
    update public.band_list_items
    set title = title || ' [manager-bypass]'
    where id = v_item_a_participant;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: manager could edit another participant title.';
  end if;

  v_caught := false;
  begin
    update public.band_list_items
    set participation_instruments = array['bass']::text[]
    where id = v_item_a_participant;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: manager could edit another participant instruments.';
  end if;

  -- Manager A who also participates: own instruments remain editable,
  -- but the participant-row title remains protected.
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_caught := false;
  begin
    update public.band_list_items
    set title = title || ' [manager-self-bypass]'
    where id = v_item_b_manager;
  exception when raise_exception then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'FAIL: participating manager could edit their own title.';
  end if;

  update public.band_list_items
  set participation_instruments = array['bass']::text[]
  where id = v_item_b_manager;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: participating manager could not edit their own instruments; affected=%', v_affected;
  end if;

  select status, participation_instruments
  into v_status, v_instruments
  from public.band_list_items
  where id = v_item_b_manager;
  if v_status is distinct from 'Confirmado'
     or v_instruments is distinct from array['bass']::text[] then
    raise exception 'FAIL: manager self-service/auto-confirm result was unexpected.';
  end if;

  -- Band owner/admin retains their broader existing edit permissions.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  update public.band_list_items
  set title = title || ' [owner-edit]'
  where id = v_item_a_participant;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'FAIL: band owner lost existing item edit permission; affected=%', v_affected;
  end if;

  raise notice 'PASS: restored-schema guard, real RLS, manager controls, NULL rejection, and nested auto-confirm verified.';
end;
$test$;

reset role;
rollback;

\echo 'OK: full-restore validation passed; all test rows, trigger effects, and function replacement were rolled back.'
