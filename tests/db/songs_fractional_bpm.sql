\set ON_ERROR_STOP on

-- Extend the disposable song fixture with the production BPM columns/check.
ALTER TABLE public.songs
  ADD COLUMN bpm integer,
  ADD COLUMN original_bpm integer,
  ADD CONSTRAINT songs_bpm_positive_check CHECK (
    ((bpm IS NULL) OR ((bpm >= 1) AND (bpm <= 400)))
    AND
    ((original_bpm IS NULL) OR ((original_bpm >= 1) AND (original_bpm <= 400)))
  );

UPDATE public.songs
SET bpm = CASE id
    WHEN '30000000-0000-0000-0000-000000000001' THEN 120
    WHEN '30000000-0000-0000-0000-000000000002' THEN 200
    WHEN '30000000-0000-0000-0000-000000000004' THEN 400
    ELSE NULL
  END,
  original_bpm = CASE id
    WHEN '30000000-0000-0000-0000-000000000001' THEN 90
    WHEN '30000000-0000-0000-0000-000000000003' THEN 400
    WHEN '30000000-0000-0000-0000-000000000004' THEN 1
    ELSE NULL
  END;

-- Apply the exact migration that is versioned and tracked in production.
\ir ../../supabase/migrations/20261108055107_support_decimal_song_bpm.sql

DO $$
DECLARE
  v_bpm_type text;
  v_bpm_precision integer;
  v_bpm_scale integer;
  v_original_type text;
  v_original_precision integer;
  v_original_scale integer;
  v_rejected boolean := false;
BEGIN
  SELECT data_type, numeric_precision, numeric_scale
  INTO v_bpm_type, v_bpm_precision, v_bpm_scale
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songs'
    AND column_name = 'bpm';

  SELECT data_type, numeric_precision, numeric_scale
  INTO v_original_type, v_original_precision, v_original_scale
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'songs'
    AND column_name = 'original_bpm';

  IF v_bpm_type <> 'numeric' OR v_bpm_precision <> 5 OR v_bpm_scale <> 2 THEN
    RAISE EXCEPTION 'songs.bpm expected numeric(5,2), got % (%,%)',
      v_bpm_type, v_bpm_precision, v_bpm_scale;
  END IF;

  IF v_original_type <> 'numeric'
     OR v_original_precision <> 5
     OR v_original_scale <> 2 THEN
    RAISE EXCEPTION 'songs.original_bpm expected numeric(5,2), got % (%,%)',
      v_original_type, v_original_precision, v_original_scale;
  END IF;

  IF (SELECT bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000001') <> 120.00
     OR (SELECT original_bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000001') <> 90.00
     OR (SELECT bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000002') <> 200.00
     OR (SELECT original_bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000003') <> 400.00
     OR (SELECT bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000004') <> 400.00 THEN
    RAISE EXCEPTION 'Existing integer BPM values were not preserved by the type conversion';
  END IF;

  IF (SELECT original_bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000002') IS NOT NULL
     OR (SELECT bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000003') IS NOT NULL THEN
    RAISE EXCEPTION 'Existing NULL BPM values were not preserved';
  END IF;

  UPDATE public.songs
  SET bpm = 123.45,
      original_bpm = 121.75
  WHERE id = '30000000-0000-0000-0000-000000000001';

  IF (SELECT bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000001') <> 123.45
     OR (SELECT original_bpm FROM public.songs WHERE id = '30000000-0000-0000-0000-000000000001') <> 121.75 THEN
    RAISE EXCEPTION 'Fractional BPM values were not preserved exactly';
  END IF;

  BEGIN
    UPDATE public.songs
    SET bpm = 400.01
    WHERE id = '30000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN check_violation THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'The existing 1–400 BPM CHECK unexpectedly allowed 400.01';
  END IF;
END;
$$;

\echo 'OK: songs.bpm and original_bpm preserve existing values and accept two-decimal BPM.'
