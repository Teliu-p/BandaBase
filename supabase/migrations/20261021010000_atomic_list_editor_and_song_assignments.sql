-- Atomic save for list metadata and its designated managers.
CREATE OR REPLACE FUNCTION public.save_band_list_with_managers(
  p_list_id uuid,
  p_band_id uuid,
  p_title text,
  p_status text,
  p_notes text,
  p_instrument_slots jsonb,
  p_manager_user_ids uuid[]
)
RETURNS SETOF public.band_lists
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_list public.band_lists%rowtype;
  v_manager_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay un usuario autenticado';
  END IF;

  IF nullif(btrim(coalesce(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'El título de la lista es obligatorio';
  END IF;

  IF p_list_id IS NULL THEN
    IF p_band_id IS NULL OR NOT public.is_band_member(p_band_id) THEN
      RAISE EXCEPTION 'No pertenecés a la banda de esta lista';
    END IF;

    INSERT INTO public.band_lists (
      band_id, title, status, notes, instrument_slots, created_by
    )
    VALUES (
      p_band_id,
      btrim(p_title),
      coalesce(nullif(btrim(p_status), ''), 'Planificada'),
      nullif(btrim(coalesce(p_notes, '')), ''),
      coalesce(p_instrument_slots, '{}'::jsonb),
      auth.uid()
    )
    RETURNING * INTO v_list;
  ELSE
    SELECT l.*
      INTO v_list
      FROM public.band_lists AS l
     WHERE l.id = p_list_id
       AND l.deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La lista no existe o fue eliminada';
    END IF;

    IF NOT public.is_band_member(v_list.band_id)
       OR (
         v_list.created_by IS DISTINCT FROM auth.uid()
         AND NOT public.is_band_admin(v_list.band_id)
       ) THEN
      RAISE EXCEPTION 'No tenés permiso para editar esta lista';
    END IF;

    IF p_band_id IS NOT NULL AND p_band_id IS DISTINCT FROM v_list.band_id THEN
      RAISE EXCEPTION 'No se puede mover una lista entre bandas';
    END IF;

    UPDATE public.band_lists
       SET title = btrim(p_title),
           status = coalesce(nullif(btrim(p_status), ''), 'Planificada'),
           notes = nullif(btrim(coalesce(p_notes, '')), ''),
           instrument_slots = coalesce(p_instrument_slots, '{}'::jsonb)
     WHERE id = p_list_id
    RETURNING * INTO v_list;
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.user_id), '{}'::uuid[])
    INTO v_manager_ids
    FROM unnest(coalesce(p_manager_user_ids, '{}'::uuid[])) AS requested(user_id)
   WHERE requested.user_id IS NOT NULL
     AND requested.user_id <> auth.uid();

  IF EXISTS (
    SELECT 1
      FROM unnest(v_manager_ids) AS requested(user_id)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.band_members AS bm
        WHERE bm.band_id = v_list.band_id
          AND bm.user_id = requested.user_id
          AND bm.active = true
     )
  ) THEN
    RAISE EXCEPTION 'Todos los responsables deben ser integrantes activos de la banda';
  END IF;

  DELETE FROM public.band_list_managers
   WHERE list_id = v_list.id;

  IF cardinality(v_manager_ids) > 0 THEN
    INSERT INTO public.band_list_managers (list_id, user_id, created_by)
    SELECT v_list.id, requested.user_id, auth.uid()
      FROM unnest(v_manager_ids) AS requested(user_id);
  END IF;

  RETURN NEXT v_list;
END;
$function$;

-- Replace the song's assignments to multiple lists in one transaction.
-- Validate the full requested set before touching any row.
CREATE OR REPLACE FUNCTION public.replace_song_list_assignments(
  p_song_id uuid,
  p_add_list_ids uuid[],
  p_remove_list_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_song public.songs%rowtype;
  v_requested_list_ids uuid[];
  v_list_id uuid;
  v_position integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No hay un usuario autenticado';
  END IF;

  SELECT s.*
    INTO v_song
    FROM public.songs AS s
   WHERE s.id = p_song_id
     AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La canción no existe o fue enviada a la papelera';
  END IF;

  IF NOT public.is_band_member(v_song.band_id) THEN
    RAISE EXCEPTION 'No pertenecés a la banda de esta canción';
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.list_id), '{}'::uuid[])
    INTO v_requested_list_ids
    FROM unnest(
      coalesce(p_add_list_ids, '{}'::uuid[])
      || coalesce(p_remove_list_ids, '{}'::uuid[])
    ) AS requested(list_id)
   WHERE requested.list_id IS NOT NULL;

  IF cardinality(v_requested_list_ids) = 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(v_requested_list_ids) AS requested(list_id)
      LEFT JOIN public.band_lists AS l
        ON l.id = requested.list_id
     WHERE l.id IS NULL
        OR l.band_id IS DISTINCT FROM v_song.band_id
        OR l.deleted_at IS NOT NULL
        OR (
          l.created_by IS DISTINCT FROM auth.uid()
          AND NOT public.is_band_admin(v_song.band_id)
        )
  ) THEN
    RAISE EXCEPTION 'Todas las listas deben estar activas, pertenecer a la banda y poder ser editadas por vos';
  END IF;

  -- Serialize position assignment for the affected lists.
  PERFORM l.id
    FROM public.band_lists AS l
   WHERE l.id = ANY(v_requested_list_ids)
   ORDER BY l.id
   FOR UPDATE;

  DELETE FROM public.band_list_items AS i
   WHERE i.list_id = ANY(coalesce(p_remove_list_ids, '{}'::uuid[]))
     AND i.item_type = 'song'
     AND i.song_id = p_song_id;

  FOR v_list_id IN
    SELECT DISTINCT requested.list_id
      FROM unnest(coalesce(p_add_list_ids, '{}'::uuid[])) AS requested(list_id)
     WHERE requested.list_id IS NOT NULL
     ORDER BY requested.list_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM public.band_list_items AS i
       WHERE i.list_id = v_list_id
         AND i.item_type = 'song'
         AND i.song_id = p_song_id
    ) THEN
      SELECT coalesce(max(i.position), -1) + 1
        INTO v_position
        FROM public.band_list_items AS i
       WHERE i.list_id = v_list_id;

      INSERT INTO public.band_list_items (
        list_id, item_type, title, details, song_id, member_user_id,
        status, position, created_by
      )
      VALUES (
        v_list_id, 'song', v_song.name, NULL, v_song.id, NULL,
        NULL, v_position, auth.uid()
      );
    END IF;
  END LOOP;
END;
$function$;

-- These RPCs are only callable by signed-in clients.
REVOKE ALL ON FUNCTION public.save_band_list_with_managers(uuid, uuid, text, text, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_band_list_with_managers(uuid, uuid, text, text, text, jsonb, uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.replace_song_list_assignments(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_song_list_assignments(uuid, uuid[], uuid[]) TO authenticated;

