\set ON_ERROR_STOP on
UPDATE bandabase_private.storage_quota_config
SET max_bytes = 1000, warning_percent = 70, critical_percent = 85
WHERE singleton = true;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

DO $quota_tests$
DECLARE v_rejected boolean; v_status jsonb;
BEGIN
  -- Storage's pre-upload RLS probe uses the client size hint.
  INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
  VALUES (
    '10000000-0000-4000-8000-000000000001', 'materials',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/one/probe.bin',
    '{"contentLength":null}'::jsonb,
    '{"bandabase_upload_size":"600"}'::jsonb
  );
  DELETE FROM storage.objects WHERE id = '10000000-0000-4000-8000-000000000001';

  -- Storage's final metadata.size overrides the client hint.
  INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
  VALUES (
    '10000000-0000-4000-8000-000000000001', 'materials',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/one/file.bin',
    '{"size":"600"}'::jsonb, '{"bandabase_upload_size":"600"}'::jsonb
  );

  v_rejected := false;
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
    VALUES (
      '10000000-0000-4000-8000-000000000002', 'materials',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/two/file.bin',
      '{"size":"401"}'::jsonb, '{"bandabase_upload_size":"401"}'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF position('BandaBase' IN SQLERRM) = 0 THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION '401 bytes above quota were accepted.'; END IF;

  UPDATE storage.objects SET metadata = '{"size":"800"}'::jsonb
  WHERE id = '10000000-0000-4000-8000-000000000001';

  v_rejected := false;
  BEGIN
    UPDATE storage.objects SET metadata = '{"size":"1001"}'::jsonb
    WHERE id = '10000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF position('BandaBase' IN SQLERRM) = 0 THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Oversized replacement was accepted.'; END IF;

  UPDATE storage.objects SET metadata = '{"size":"1000"}'::jsonb
  WHERE id = '10000000-0000-4000-8000-000000000001';

  v_rejected := false;
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
    VALUES (
      '10000000-0000-4000-8000-000000000003', 'materials',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/three/file.bin',
      '{"size":"1"}'::jsonb, '{"bandabase_upload_size":"1"}'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF position('BandaBase' IN SQLERRM) = 0 THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'One byte above exact limit was accepted.'; END IF;

  DELETE FROM storage.objects WHERE id = '10000000-0000-4000-8000-000000000001';

  INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
  VALUES (
    '10000000-0000-4000-8000-000000000004', 'materials',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/four/file.bin',
    '{"size":"1000"}'::jsonb, '{"bandabase_upload_size":"1000"}'::jsonb
  );

  v_rejected := false;
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
    VALUES (
      '10000000-0000-4000-8000-000000000005', 'materials',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/five/file.bin', '{}'::jsonb, '{}'::jsonb
    );
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF position('tamaño' IN SQLERRM) = 0 THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Unknown-size upload was accepted.'; END IF;

  v_status := public.get_storage_quota_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  IF (v_status ->> 'used_bytes')::numeric <> 1000
     OR (v_status ->> 'limit_bytes')::bigint <> 1000
     OR (v_status ->> 'object_count')::bigint <> 1
     OR (v_status ->> 'remaining_bytes')::numeric <> 0 THEN
    RAISE EXCEPTION 'Unexpected quota status: %', v_status;
  END IF;
END;
$quota_tests$;

SELECT pg_catalog.set_config('request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
DO $membership_test$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.get_storage_quota_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Non-member read the quota.'; END IF;
END;
$membership_test$;
ROLLBACK;

DO $policy_tests$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'existing_app_upload_policy' AND permissive = 'PERMISSIVE'
  ) THEN RAISE EXCEPTION 'Existing permissive app policy was not preserved.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bandabase_storage_quota_insert'
      AND permissive = 'RESTRICTIVE' AND cmd = 'INSERT'
  ) THEN RAISE EXCEPTION 'Restrictive INSERT policy is missing.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'bandabase_storage_quota_update'
      AND permissive = 'RESTRICTIVE' AND cmd = 'UPDATE'
  ) THEN RAISE EXCEPTION 'Restrictive UPDATE policy is missing.'; END IF;
END;
$policy_tests$;

\echo 'OK: quota guard verifies preflight, measured size, replacements, limit, deletion, missing sizes and membership.'
