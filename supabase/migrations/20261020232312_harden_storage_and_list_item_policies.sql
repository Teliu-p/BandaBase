-- Tighten reads in the private Storage bucket to active parent records.
-- Paths used by the app:
--   <band_id>/<material_id>/<filename>
--   <band_id>/comments/<comment_id>/<filename>
--   <band_id>/proposals/<proposal_id>/<filename>
--
-- The UUID CASE expressions deliberately return NULL for malformed path
-- segments, so a non-UUID folder can never raise a cast error or match a row.

DROP POLICY IF EXISTS material_files_select_member ON storage.objects;

CREATE POLICY material_files_select_member
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    EXISTS (
      SELECT 1
      FROM public.materials AS m
      WHERE m.id = CASE
        WHEN (storage.foldername(objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (storage.foldername(objects.name))[2]::uuid
      END
        AND m.band_id = CASE
          WHEN (storage.foldername(objects.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (storage.foldername(objects.name))[1]::uuid
        END
        AND public.is_band_member(m.band_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.comments AS c
      WHERE (storage.foldername(objects.name))[2] = 'comments'
        AND c.id = CASE
          WHEN (storage.foldername(objects.name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (storage.foldername(objects.name))[3]::uuid
        END
        AND c.band_id = CASE
          WHEN (storage.foldername(objects.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (storage.foldername(objects.name))[1]::uuid
        END
        AND c.deleted_at IS NULL
        AND public.is_band_member(c.band_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.proposals AS p
      WHERE (storage.foldername(objects.name))[2] = 'proposals'
        AND p.id = CASE
          WHEN (storage.foldername(objects.name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (storage.foldername(objects.name))[3]::uuid
        END
        AND p.band_id = CASE
          WHEN (storage.foldername(objects.name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (storage.foldername(objects.name))[1]::uuid
        END
        AND p.deleted_at IS NULL
        AND public.is_band_member(p.band_id)
    )
  )
);

-- Consolidate the overlapping UPDATE policies. The prior permissive policies
-- were OR-combined, and the older one allowed edits to items in trashed lists.
-- Keep self-service changes to an "Anotado" participation and manager controls,
-- while requiring the parent list to remain active in every case.

DROP POLICY IF EXISTS band_list_items_update_control ON public.band_list_items;
DROP POLICY IF EXISTS band_list_items_update_control_v2 ON public.band_list_items;

CREATE POLICY band_list_items_update_control
ON public.band_list_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.band_lists AS l
    WHERE l.id = band_list_items.list_id
      AND l.deleted_at IS NULL
      AND public.is_band_member(l.band_id)
      AND (
        public.is_band_admin(l.band_id)
        OR l.created_by = (SELECT auth.uid())
        OR (
          band_list_items.item_type = 'member'
          AND band_list_items.member_user_id = (SELECT auth.uid())
          AND band_list_items.status = 'Anotado'
        )
        OR (
          band_list_items.item_type = 'member'
          AND EXISTS (
            SELECT 1
            FROM public.band_list_managers AS m
            WHERE m.list_id = l.id
              AND m.user_id = (SELECT auth.uid())
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.band_lists AS l
    WHERE l.id = band_list_items.list_id
      AND l.deleted_at IS NULL
      AND public.is_band_member(l.band_id)
      AND (
        (
          (
            public.is_band_admin(l.band_id)
            OR l.created_by = (SELECT auth.uid())
          )
          AND (
            band_list_items.song_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.songs AS s
              WHERE s.id = band_list_items.song_id
                AND s.band_id = l.band_id
            )
          )
          AND (
            band_list_items.member_user_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.band_members AS bm
              WHERE bm.band_id = l.band_id
                AND bm.user_id = band_list_items.member_user_id
                AND bm.active = true
            )
          )
        )
        OR (
          band_list_items.item_type = 'member'
          AND band_list_items.member_user_id = (SELECT auth.uid())
          AND band_list_items.status = 'Anotado'
          AND cardinality(band_list_items.participation_instruments) > 0
          AND band_list_items.participation_instruments
            <@ ARRAY['guitar', 'voice', 'keyboard', 'bass', 'drums']::text[]
        )
        OR (
          band_list_items.item_type = 'member'
          AND band_list_items.status IN ('Anotado', 'Confirmado')
          AND EXISTS (
            SELECT 1
            FROM public.band_list_managers AS m
            WHERE m.list_id = l.id
              AND (
                l.created_by = (SELECT auth.uid())
                OR m.user_id = (SELECT auth.uid())
              )
          )
          AND EXISTS (
            SELECT 1
            FROM public.band_members AS bm
            WHERE bm.band_id = l.band_id
              AND bm.user_id = band_list_items.member_user_id
              AND bm.active = true
          )
        )
      )
  )
);

-- Covering indexes for foreign keys that Supabase flagged as unindexed.
-- Several tables are currently nearly empty, but these links are on common
-- ownership, band-membership, and content-parent paths.

CREATE INDEX IF NOT EXISTS idx_band_list_items_created_by
  ON public.band_list_items (created_by);
CREATE INDEX IF NOT EXISTS idx_band_lists_created_by
  ON public.band_lists (created_by);
CREATE INDEX IF NOT EXISTS idx_band_members_user_id
  ON public.band_members (user_id);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_created_by
  ON public.comment_attachments (created_by);
CREATE INDEX IF NOT EXISTS idx_comments_user_id
  ON public.comments (user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_band_id
  ON public.decisions (band_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_by
  ON public.decisions (created_by);
CREATE INDEX IF NOT EXISTS idx_material_attachments_created_by
  ON public.material_attachments (created_by);
CREATE INDEX IF NOT EXISTS idx_material_blocks_attachment_id
  ON public.material_blocks (attachment_id);
CREATE INDEX IF NOT EXISTS idx_materials_band_id
  ON public.materials (band_id);
CREATE INDEX IF NOT EXISTS idx_materials_created_by
  ON public.materials (created_by);
CREATE INDEX IF NOT EXISTS idx_parking_lot_band_id
  ON public.parking_lot (band_id);
CREATE INDEX IF NOT EXISTS idx_parking_lot_created_by
  ON public.parking_lot (created_by);
CREATE INDEX IF NOT EXISTS idx_problems_band_id
  ON public.problems (band_id);
CREATE INDEX IF NOT EXISTS idx_problems_created_by
  ON public.problems (created_by);
CREATE INDEX IF NOT EXISTS idx_problems_rehearsal_id
  ON public.problems (rehearsal_id);
CREATE INDEX IF NOT EXISTS idx_problems_song_id
  ON public.problems (song_id);
CREATE INDEX IF NOT EXISTS idx_proposal_attachments_band_id
  ON public.proposal_attachments (band_id);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_option_id
  ON public.proposal_votes (option_id);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by
  ON public.proposals (created_by);
CREATE INDEX IF NOT EXISTS idx_rehearsal_roles_user_id
  ON public.rehearsal_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_created_by
  ON public.rehearsals (created_by);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_song_id
  ON public.setlist_songs (song_id);
CREATE INDEX IF NOT EXISTS idx_setlists_band_id
  ON public.setlists (band_id);
CREATE INDEX IF NOT EXISTS idx_setlists_created_by
  ON public.setlists (created_by);
CREATE INDEX IF NOT EXISTS idx_songs_created_by
  ON public.songs (created_by);
