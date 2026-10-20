-- Keep a song's scalar fields and structured singer/key rows in one transaction.
CREATE OR REPLACE FUNCTION public.save_song_with_singers(
  p_song_id uuid,
  p_song_data jsonb,
  p_singers jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_band_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay un usuario autenticado';
  END IF;

  IF jsonb_typeof(p_song_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos de la canción no son válidos';
  END IF;

  SELECT s.band_id
    INTO v_band_id
    FROM public.songs AS s
   WHERE s.id = p_song_id
     AND s.deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La canción no existe o fue enviada a la papelera';
  END IF;

  IF NOT public.is_band_member(v_band_id) THEN
    RAISE EXCEPTION 'No pertenecés a la banda de esta canción';
  END IF;

  UPDATE public.songs
     SET name = btrim(coalesce(p_song_data->>'name', '')),
         artist = nullif(btrim(coalesce(p_song_data->>'artist', '')), ''),
         genre = CASE
           WHEN jsonb_typeof(p_song_data->'genre') = 'array'
             THEN ARRAY(
               SELECT jsonb_array_elements_text(p_song_data->'genre')
             )
           ELSE NULL
         END,
         bpm = nullif(p_song_data->>'bpm', '')::integer,
         duration = nullif(p_song_data->>'duration', '')::integer,
         meter = nullif(btrim(coalesce(p_song_data->>'meter', '')), ''),
         color = nullif(btrim(coalesce(p_song_data->>'color', '')), ''),
         status = coalesce(nullif(btrim(p_song_data->>'status'), ''), 'Pendiente'),
         active_status = coalesce(nullif(btrim(p_song_data->>'active_status'), ''), 'Activa'),
         singer = nullif(btrim(coalesce(p_song_data->>'singer', '')), ''),
         song_key = nullif(btrim(coalesce(p_song_data->>'song_key', '')), ''),
         original_bpm = nullif(p_song_data->>'original_bpm', '')::integer,
         original_key = nullif(btrim(coalesce(p_song_data->>'original_key', '')), ''),
         original_duration = nullif(p_song_data->>'original_duration', '')::integer,
         original_meter = nullif(btrim(coalesce(p_song_data->>'original_meter', '')), ''),
         updated_at = now()
   WHERE id = p_song_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo actualizar la canción';
  END IF;

  -- A failure inside the singer replacement rolls back the song-field UPDATE too.
  PERFORM public.replace_song_singers(
    p_song_id,
    coalesce(p_singers, '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_song_with_singers(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_song_with_singers(uuid, jsonb, jsonb) TO authenticated;


-- Trash a selected set of comments only when every row is visible, active,
-- and updatable by the current user. No partial bulk delete when one ID fails.
CREATE OR REPLACE FUNCTION public.trash_comments_bulk(
  p_comment_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_ids uuid[];
  v_visible_count integer;
  v_updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay un usuario autenticado';
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.comment_id), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_comment_ids, '{}'::uuid[])) AS requested(comment_id)
   WHERE requested.comment_id IS NOT NULL;

  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  SELECT count(*)
    INTO v_visible_count
    FROM public.comments AS c
   WHERE c.id = ANY(v_ids)
     AND c.deleted_at IS NULL;

  IF v_visible_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'No se eliminaron comentarios: alguno no existe, ya está en la papelera o no tenés permiso';
  END IF;

  UPDATE public.comments
     SET deleted_at = now(),
         deleted_by = auth.uid()
   WHERE id = ANY(v_ids)
     AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'No se pudieron mover todos los comentarios a la papelera';
  END IF;

  RETURN v_updated_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.trash_comments_bulk(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trash_comments_bulk(uuid[]) TO authenticated;
