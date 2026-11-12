-- Enforce a project-wide Storage cap for authenticated client uploads.
-- The client size hint is used for the pre-upload RLS probe only. At completion,
-- Storage's measured metadata.size takes precedence.

CREATE SCHEMA IF NOT EXISTS bandabase_private;
REVOKE ALL ON SCHEMA bandabase_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA bandabase_private TO authenticated;

CREATE TABLE IF NOT EXISTS bandabase_private.storage_quota_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  max_bytes bigint NOT NULL CHECK (max_bytes > 0),
  warning_percent integer NOT NULL CHECK (warning_percent BETWEEN 1 AND 99),
  critical_percent integer NOT NULL CHECK (critical_percent BETWEEN 1 AND 100)
);

REVOKE ALL ON TABLE bandabase_private.storage_quota_config
  FROM PUBLIC, anon, authenticated;

INSERT INTO bandabase_private.storage_quota_config (
  singleton, max_bytes, warning_percent, critical_percent
)
VALUES (true, 700000000, 70, 85)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION bandabase_private.enforce_storage_quota(
  p_metadata jsonb,
  p_user_metadata jsonb,
  p_object_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_size_text text;
  v_new_bytes numeric;
  v_used_bytes numeric;
  v_invalid_size_count bigint;
  v_limit_bytes bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Se necesita una sesión autenticada para subir archivos.';
  END IF;

  -- Storage runs an RLS permission probe before transferring bytes. In that
  -- phase metadata.size is not available, so use the client size hint.
  -- On completion Storage's measured metadata.size always takes precedence.
  v_size_text := COALESCE(
    NULLIF(p_metadata ->> 'size', ''),
    NULLIF(p_user_metadata ->> 'bandabase_upload_size', ''),
    NULLIF(p_metadata ->> 'contentLength', '')
  );

  IF v_size_text IS NULL OR v_size_text !~ '^[0-9]{1,18}$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'BandaBase bloqueó la subida porque no pudo verificar el tamaño del archivo.';
  END IF;
  v_new_bytes := v_size_text::numeric;

  -- Serialize project uploads. A waiting VOLATILE function reads a fresh
  -- READ COMMITTED snapshot after acquiring the transaction-scoped lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bandabase.storage.quota.v1', 0)
  );

  SELECT max_bytes INTO v_limit_bytes
  FROM bandabase_private.storage_quota_config
  WHERE singleton = true;

  IF v_limit_bytes IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'BandaBase no pudo verificar el límite; la subida se bloqueó por seguridad.';
  END IF;

  SELECT
    COALESCE(
      SUM(CASE
        WHEN COALESCE(o.metadata ->> 'size', '') ~ '^[0-9]{1,18}$'
          THEN (o.metadata ->> 'size')::numeric
        ELSE 0
      END),
      0
    ),
    COUNT(*) FILTER (
      WHERE COALESCE(o.metadata ->> 'size', '') !~ '^[0-9]{1,18}$'
    )
  INTO v_used_bytes, v_invalid_size_count
  FROM storage.objects AS o
  WHERE o.id IS DISTINCT FROM p_object_id;

  IF v_invalid_size_count > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'BandaBase bloqueó nuevas subidas porque hay archivos existentes cuyo tamaño no se puede verificar.';
  END IF;

  IF v_used_bytes + v_new_bytes > v_limit_bytes::numeric THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE =
        'BandaBase alcanzó el límite de almacenamiento de ' ||
        (v_limit_bytes / 1000000)::text ||
        ' MB. Eliminá archivos existentes y volvé a intentarlo.';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION bandabase_private.enforce_storage_quota(jsonb, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bandabase_private.enforce_storage_quota(jsonb, jsonb, uuid)
  TO authenticated;

-- Restrictive policies AND with existing band/owner policies.
-- Existing SELECT and DELETE permissions are intentionally unchanged.
DROP POLICY IF EXISTS bandabase_storage_quota_insert ON storage.objects;
CREATE POLICY bandabase_storage_quota_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bandabase_private.enforce_storage_quota(metadata, user_metadata, id)
);

DROP POLICY IF EXISTS bandabase_storage_quota_update ON storage.objects;
CREATE POLICY bandabase_storage_quota_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  bandabase_private.enforce_storage_quota(metadata, user_metadata, id)
);

CREATE OR REPLACE FUNCTION public.get_storage_quota_status(p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_limit_bytes bigint;
  v_warning_percent integer;
  v_critical_percent integer;
  v_used_bytes numeric;
  v_object_count bigint;
  v_invalid_size_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.band_members AS bm
    WHERE bm.band_id = p_band_id
      AND bm.user_id = auth.uid()
      AND bm.active = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'No tenés permiso para consultar el almacenamiento de esta banda.';
  END IF;

  SELECT max_bytes, warning_percent, critical_percent
  INTO v_limit_bytes, v_warning_percent, v_critical_percent
  FROM bandabase_private.storage_quota_config
  WHERE singleton = true;

  IF v_limit_bytes IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'No se encontró la configuración del límite de almacenamiento.';
  END IF;

  SELECT
    COALESCE(
      SUM(CASE
        WHEN COALESCE(o.metadata ->> 'size', '') ~ '^[0-9]{1,18}$'
          THEN (o.metadata ->> 'size')::numeric
        ELSE 0
      END),
      0
    ),
    COUNT(*),
    COUNT(*) FILTER (
      WHERE COALESCE(o.metadata ->> 'size', '') !~ '^[0-9]{1,18}$'
    )
  INTO v_used_bytes, v_object_count, v_invalid_size_count
  FROM storage.objects AS o;

  RETURN pg_catalog.jsonb_build_object(
    'used_bytes', v_used_bytes,
    'limit_bytes', v_limit_bytes,
    'remaining_bytes', GREATEST(v_limit_bytes::numeric - v_used_bytes, 0),
    'object_count', v_object_count,
    'warning_percent', v_warning_percent,
    'critical_percent', v_critical_percent,
    'invalid_size_count', v_invalid_size_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_storage_quota_status(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_quota_status(uuid)
  TO authenticated;
