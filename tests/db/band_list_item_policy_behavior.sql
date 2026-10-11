\set ON_ERROR_STOP on

-- Structural assertion: there must be one UPDATE policy, and the broad legacy
-- policy must be gone after applying the migration.
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
    raise exception 'Expected exactly one UPDATE policy on band_list_items, found %', update_policy_count;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'band_list_items'
      and policyname = 'band_list_items_update_control_v2'
  ) then
    raise exception 'The broad legacy UPDATE policy still exists.';
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
  -- An administrator can still make a valid same-band song change.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );

  update public.band_list_items
  set song_id = '30000000-0000-0000-0000-000000000002'
  where id = '50000000-0000-0000-0000-000000000001';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Administrator should be able to update a valid list item; affected rows=%', affected;
  end if;

  select song_id into actual_song
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000001';

  if actual_song <> '30000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'Valid same-band song update was not persisted within the test transaction.';
  end if;

  -- The same administrator must now be rejected when assigning another band's song.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set song_id = '30000000-0000-0000-0000-000000000003'
    where id = '50000000-0000-0000-0000-000000000001';
  exception
    when insufficient_privilege then
      caught_expected_error := true;
  end;

  if not caught_expected_error then
    raise exception 'Cross-band song assignment was not rejected by RLS.';
  end if;

  select song_id into actual_song
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000001';

  if actual_song <> '30000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'Rejected cross-band update changed the row.';
  end if;

  -- Administrators cannot assign an inactive band member to a participation row.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set member_user_id = '10000000-0000-0000-0000-000000000005'
    where id = '50000000-0000-0000-0000-000000000003';
  exception
    when insufficient_privilege then
      caught_expected_error := true;
  end;

  if not caught_expected_error then
    raise exception 'Assignment of an inactive member was not rejected by RLS.';
  end if;

  select member_user_id into actual_member
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';

  if actual_member <> '10000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'Rejected inactive-member assignment changed the row.';
  end if;

  -- The list creator retains ordinary editing rights.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
  );

  update public.band_list_items
  set title = 'Título editado por creador'
  where id = '50000000-0000-0000-0000-000000000001';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'The list creator lost valid item-edit permissions.';
  end if;

  select title into actual_title
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000001';

  if actual_title <> 'Título editado por creador' then
    raise exception 'Creator title update did not persist within the test transaction.';
  end if;

  -- A list manager may change a participant's status.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000004',
    true
  );

  update public.band_list_items
  set status = 'Confirmado'
  where id = '50000000-0000-0000-0000-000000000003';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'The list manager lost valid participation-status permissions.';
  end if;

  select status into actual_status
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';

  if actual_status <> 'Confirmado' then
    raise exception 'The list manager status change did not persist in the test transaction.';
  end if;

  -- The unchanged production trigger still prevents a manager from editing
  -- another participant's selected instruments.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set participation_instruments = array['bass']::text[]
    where id = '50000000-0000-0000-0000-000000000003';
  exception
    when raise_exception then
      caught_expected_error := true;
  end;

  if not caught_expected_error then
    raise exception 'The manager edit guard did not reject an instrument change.';
  end if;

  select participation_instruments into actual_instruments
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000003';

  if actual_instruments <> array['voice']::text[] then
    raise exception 'Rejected manager instrument edit changed the row.';
  end if;

  -- A member can update their own instrument selection while still annotated.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );

  update public.band_list_items
  set participation_instruments = array['bass']::text[]
  where id = '50000000-0000-0000-0000-000000000002';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'A member lost valid self-service instrument editing.';
  end if;

  -- Self-service must not allow a member to confirm themselves.
  caught_expected_error := false;
  begin
    update public.band_list_items
    set status = 'Confirmado'
    where id = '50000000-0000-0000-0000-000000000002';
  exception
    when insufficient_privilege then
      caught_expected_error := true;
  end;

  if not caught_expected_error then
    raise exception 'A member was able to confirm their own participation.';
  end if;

  select status into actual_status
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000002';

  if actual_status <> 'Anotado' then
    raise exception 'Rejected self-confirmation changed the member status.';
  end if;

  -- A person who belongs only to another band cannot update this band's list.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000006',
    true
  );

  update public.band_list_items
  set title = 'Cambio no autorizado'
  where id = '50000000-0000-0000-0000-000000000001';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'An outsider was able to update another band''s list item.';
  end if;

  -- Even an administrator cannot update an item in a soft-deleted list.
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );

  update public.band_list_items
  set title = 'Cambio en papelera'
  where id = '50000000-0000-0000-0000-000000000004';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'An item in a soft-deleted list was editable.';
  end if;
end;
$test$;

rollback;

\echo 'OK: PostgreSQL RLS policy regression cases passed.'
