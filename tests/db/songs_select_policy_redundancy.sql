\set ON_ERROR_STOP on

-- Verify the current two-policy visibility, apply the exact candidate migration,
-- then prove that visibility is unchanged with only the broader policy remaining.
BEGIN;

SET LOCAL ROLE authenticated;

DO $before_cleanup$
DECLARE
  v_visible uuid[];
BEGIN
  -- Band admin: active songs plus every trashed song in their band.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000004'::uuid
  ] THEN
    RAISE EXCEPTION 'before_cleanup: admin visibility changed: %', v_visible;
  END IF;

  -- Ordinary member: active songs plus only their own trashed song.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid
  ] THEN
    RAISE EXCEPTION 'before_cleanup: member own-trash visibility changed: %', v_visible;
  END IF;

  -- A second ordinary member must not see another member's trashed song.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000004',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000004'::uuid
  ] THEN
    RAISE EXCEPTION 'before_cleanup: second member visibility changed: %', v_visible;
  END IF;

  -- A member with no own trashed song sees active songs only.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid
  ] THEN
    RAISE EXCEPTION 'before_cleanup: ordinary member visibility changed: %', v_visible;
  END IF;

  -- A member of another band sees only active songs from that band.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000006',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000003'::uuid
  ] THEN
    RAISE EXCEPTION 'before_cleanup: cross-band isolation changed: %', v_visible;
  END IF;

  -- Inactive members cannot read songs through either permissive policy.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000005',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF cardinality(v_visible) <> 0 THEN
    RAISE EXCEPTION 'before_cleanup: inactive member unexpectedly saw songs: %', v_visible;
  END IF;
END;
$before_cleanup$;

RESET ROLE;

DO $structure_before$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND policyname = 'songs_select_active_or_admin'
      AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND policyname = 'songs_select_active_or_own_trash_or_admin'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Expected both current songs SELECT policies before cleanup.';
  END IF;
END;
$structure_before$;

\ir ../../supabase/migrations/20261107231924_remove_redundant_songs_select_policy.sql

DO $structure_after$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND policyname = 'songs_select_active_or_admin'
  ) THEN
    RAISE EXCEPTION 'Redundant songs SELECT policy remains after migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'songs'
      AND policyname = 'songs_select_active_or_own_trash_or_admin'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'The intended songs SELECT policy was removed.';
  END IF;
END;
$structure_after$;

SET LOCAL ROLE authenticated;

DO $after_cleanup$
DECLARE
  v_visible uuid[];
BEGIN
  -- Band admin: active songs plus every trashed song in their band.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid,
    '30000000-0000-0000-0000-000000000004'::uuid
  ] THEN
    RAISE EXCEPTION 'after_cleanup: admin visibility changed: %', v_visible;
  END IF;

  -- Ordinary member: active songs plus only their own trashed song.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000002'::uuid
  ] THEN
    RAISE EXCEPTION 'after_cleanup: member own-trash visibility changed: %', v_visible;
  END IF;

  -- A second ordinary member must not see another member's trashed song.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000004',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid,
    '30000000-0000-0000-0000-000000000004'::uuid
  ] THEN
    RAISE EXCEPTION 'after_cleanup: second member visibility changed: %', v_visible;
  END IF;

  -- A member with no own trashed song sees active songs only.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000001'::uuid
  ] THEN
    RAISE EXCEPTION 'after_cleanup: ordinary member visibility changed: %', v_visible;
  END IF;

  -- A member of another band sees only active songs from that band.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000006',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF v_visible IS DISTINCT FROM ARRAY[
    '30000000-0000-0000-0000-000000000003'::uuid
  ] THEN
    RAISE EXCEPTION 'after_cleanup: cross-band isolation changed: %', v_visible;
  END IF;

  -- Inactive members cannot read songs through either permissive policy.
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000005',
    true
  );
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_visible
  FROM public.songs;
  IF cardinality(v_visible) <> 0 THEN
    RAISE EXCEPTION 'after_cleanup: inactive member unexpectedly saw songs: %', v_visible;
  END IF;
END;
$after_cleanup$;

RESET ROLE;

ROLLBACK;

\echo 'OK: songs SELECT visibility is unchanged after removing the redundant permissive policy.'
