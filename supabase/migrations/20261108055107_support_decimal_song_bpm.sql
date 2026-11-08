ALTER TABLE public.songs
  ALTER COLUMN bpm TYPE numeric(5,2) USING bpm::numeric(5,2),
  ALTER COLUMN original_bpm TYPE numeric(5,2) USING original_bpm::numeric(5,2);
