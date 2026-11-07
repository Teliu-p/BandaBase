\set ON_ERROR_STOP on

-- Prove the current trigger/policy combination permits a participant to edit
-- a field that the UI does not authorize, before the candidate migration.
begin;
set local role authenticated;

do $test$
declare
  affected integer;
  actual_title text;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );

  update public.band_list_items
  set title = 'Título manipulado antes de la corrección'
  where id = '50000000-0000-0000-0000-000000000002';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Expected the current self-service policy to allow the update before the trigger fix; affected=%', affected;
  end if;

  select title into actual_title
  from public.band_list_items
  where id = '50000000-0000-0000-0000-000000000002';

  if actual_title <> 'Título manipulado antes de la corrección' then
    raise exception 'The pre-fix self-service field-change reproduction did not persist.';
  end if;
end;
$test$;

rollback;
