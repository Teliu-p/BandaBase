-- Songs are intentionally collaborative: every active band member may edit
-- an active song. Deletion/trash remains restricted to the creator or Admin,
-- while identity fields remain protected by the existing trigger.

DROP POLICY IF EXISTS songs_update_own_or_admin ON public.songs;
CREATE POLICY songs_update_band_member
ON public.songs
FOR UPDATE
TO authenticated
USING (
  is_band_member(band_id)
  AND deleted_at IS NULL
)
WITH CHECK (
  is_band_member(band_id)
  AND deleted_at IS NULL
);

-- The singer rows belong to the collaborative song editor. Any active
-- member may maintain them while the song itself is active.
DROP POLICY IF EXISTS song_singers_insert_song_owner_or_admin_v2 ON public.song_singers;
CREATE POLICY song_singers_insert_band_member_v3
ON public.song_singers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.songs s
    WHERE s.id = song_singers.song_id
      AND s.deleted_at IS NULL
      AND is_band_member(s.band_id)
  )
);

DROP POLICY IF EXISTS song_singers_update_song_owner_or_admin_v2 ON public.song_singers;
CREATE POLICY song_singers_update_band_member_v3
ON public.song_singers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.songs s
    WHERE s.id = song_singers.song_id
      AND s.deleted_at IS NULL
      AND is_band_member(s.band_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.songs s
    WHERE s.id = song_singers.song_id
      AND s.deleted_at IS NULL
      AND is_band_member(s.band_id)
  )
);

DROP POLICY IF EXISTS song_singers_delete_song_owner_or_admin_v2 ON public.song_singers;
CREATE POLICY song_singers_delete_band_member_v3
ON public.song_singers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.songs s
    WHERE s.id = song_singers.song_id
      AND s.deleted_at IS NULL
      AND is_band_member(s.band_id)
  )
);
