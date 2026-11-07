\set ON_ERROR_STOP on

do $structure$
declare
  update_policy_count integer;
begin
  select count(*) into update_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'band_list_items'
    and cmd = 'UPDATE';

  if update_policy_count <> 1 then
    raise exception 'Expected one UPDATE policy after trigger-only migration, found %', update_policy_count;
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'band_list_items'
      and t.tgname = 'manager_list_item_edit_guard'
      and not t.tgisinternal
  ) then
    raise exception 'The manager/self-edit guard trigger is missing.';
  end if;
end;
$structure$;

begin;
set local role authenticated;

do $test$
declare
  affected integer;
  actual_song uuid;
  actual_member uuid;
  actual_status text;
  actual_title text;
  actual_instruments text[];
  caught_expected_error boolean;
begin
  -- Admin retains valid same-band editing.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
  update public.band_list_items
  set song_id = '30000000-0000-0000-0000-000000000002'
  where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Admin lost valid same-band song edit; affected=%', affected;
  end if;

  -- Admin cannot connect a song from another band.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set song_id = '30000000-0000-0000-0000-000000000003'
    where id = '50000000-0000-0000-0000-000000000001';
  exception
    when insufficient_privilege then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Cross-band song assignment was not rejected.';
  end if;

  -- Admin cannot assign an inactive member to a participant row.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set member_user_id = '10000000-0000-0000-0000-000000000005'
    where id = '50000000-0000-0000-0000-000000000003';
  exception
    when insufficient_privilege then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Assignment of an inactive member was not rejected.';
  end if;
  select member_user_id into actual_member
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';
  if actual_member <> '10000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'Rejected inactive-member assignment changed the row.';
  end if;

  -- The list creator retains ordinary full edit rights.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
  update public.band_list_items
  set title = 'Título editado por creador'
  where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'List creator lost valid edit rights; affected=%', affected;
  end if;

  -- Manager can change another participant's status.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
  update public.band_list_items
  set status = 'Confirmado'
  where id = '50000000-0000-0000-0000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'List manager lost status-control rights; affected=%', affected;
  end if;
  select status into actual_status
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';
  if actual_status <> 'Confirmado' then
    raise exception 'Manager status change did not persist.';
  end if;

  -- Manager cannot change another participant's instruments.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set participation_instruments = array['bass']::text[]
    where id = '50000000-0000-0000-0000-000000000003';
  exception
    when raise_exception then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Manager changed another participant''s instruments.';
  end if;
  select participation_instruments into actual_instruments
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';
  if actual_instruments <> array['voice']::text[] then
    raise exception 'Rejected manager instrument edit changed the row.';
  end if;

  -- A manager who is also participating can still edit their own instruments.
  update public.band_list_items
  set participation_instruments = array['bass']::text[]
  where id = '50000000-0000-0000-0000-000000000006';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Manager who participates lost self-service instrument editing.';
  end if;
  select participation_instruments into actual_instruments
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000006';
  if actual_instruments <> array['bass']::text[] then
    raise exception 'Manager self-service instrument selection did not persist.';
  end if;

  -- The same manager still cannot change other fields on their own participant row.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set title = 'Título no autorizado del responsable'
    where id = '50000000-0000-0000-0000-000000000006';
  exception
    when raise_exception then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Manager changed a non-instrument field on their own participant row.';
  end if;

  -- Ordinary participant may change their own instruments while annotated.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
  update public.band_list_items
  set participation_instruments = array['bass']::text[]
  where id = '50000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Participant lost valid self-service instrument editing; affected=%', affected;
  end if;

  -- Self-service cannot change title, details or move the row to another list.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set title = 'Título alterado sin permiso'
    where id = '50000000-0000-0000-0000-000000000002';
  exception
    when raise_exception then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Participant was able to change their row title.';
  end if;

  caught_expected_error := false;
  begin
    update public.band_list_items
    set details = 'Detalle alterado sin permiso'
    where id = '50000000-0000-0000-0000-000000000002';
  exception
    when raise_exception then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Participant was able to change their row details.';
  end if;

  caught_expected_error := false;
  begin
    update public.band_list_items
    set list_id = '40000000-0000-0000-0000-000000000003'
    where id = '50000000-0000-0000-0000-000000000002';
  exception
    when raise_exception or insufficient_privilege then caught_expected_error := true;
  end;
  if not caught_expected_error then
    raise exception 'Participant was able to move their row to another list.';
  end if;

  select title into actual_title
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000002';
  if actual_title <> 'Integrante propio' then
    raise exception 'A rejected self-service title edit changed the row.';
  end if;

  -- Direct self-confirmation is rejected while the slot is available.
  caught_expected_error := false;
  affected := -1;
  begin
    update public.band_list_items
    set status = 'Confirmado'
    where id = '50000000-0000-0000-0000-000000000005';
    get diagnostics affected = row_count;
  exception
    when raise_exception or insufficient_privilege then caught_expected_error := true;
  end;
  if not caught_expected_error and affected <> 0 then
    raise exception 'Participant was able to confirm themselves directly; affected=%', affected;
  end if;
  select status into actual_status
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000005';
  if actual_status <> 'Anotado' then
    raise exception 'Rejected direct self-confirmation changed status.';
  end if;

  -- A valid self-service instrument change still triggers trusted auto-confirmation.
  update public.band_list_items
  set participation_instruments = array['bass']::text[]
  where id = '50000000-0000-0000-0000-000000000005';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Valid instrument update was rejected on an available-capacity list.';
  end if;
  select status, participation_instruments
  into actual_status, actual_instruments
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000005';
  if actual_status <> 'Confirmado' then
    raise exception 'Trusted auto-confirmation did not transition the eligible participant.';
  end if;
  if actual_instruments <> array['bass']::text[] then
    raise exception 'Trusted auto-confirmation did not preserve the selected instruments.';
  end if;

  -- A member of a different band cannot edit this band's list.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
  update public.band_list_items
  set title = 'Cambio de usuario externo'
  where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Outsider updated another band''s list item.';
  end if;

  -- Even an admin cannot edit an item in a soft-deleted list.
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
  update public.band_list_items
  set title = 'Cambio en papelera'
  where id = '50000000-0000-0000-0000-000000000004';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Admin updated an item in a soft-deleted list.';
  end if;
end;
$test$;

rollback;

\echo 'OK: band_list_items self-service and manager guard regression cases passed.'
