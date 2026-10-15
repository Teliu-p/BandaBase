\set ON_ERROR_STOP on

-- Reproduce the documented bypass before the repair migration:
-- the broad permissive v2 policy OR-combines with the stricter policy,
-- so an admin can relink a list item to a song from another band's repertoire.
begin;
set local role authenticated;

do $test$
declare
  affected integer;
  actual_song uuid;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );

  update public.band_list_items
  set song_id = '30000000-0000-0000-0000-000000000003'
  where id = '50000000-0000-0000-0000-000000000001';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'Fixture no longer reproduces the legacy RLS bypass; affected rows=%', affected;
  end if;

  select song_id into actual_song
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000001';

  if actual_song <> '30000000-0000-0000-0000-000000000003'::uuid then
    raise exception 'Expected the legacy policy to allow the invalid cross-band song assignment.';
  end if;
end;
$test$;

rollback;
