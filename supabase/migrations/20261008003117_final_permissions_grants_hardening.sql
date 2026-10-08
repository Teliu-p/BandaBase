-- Finalize object-level list participation permissions and least-privilege table grants.

DROP POLICY IF EXISTS band_list_items_insert_control_v2 ON public.band_list_items;
CREATE POLICY band_list_items_insert_control_v3
ON public.band_list_items
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.band_lists l
    WHERE l.id = band_list_items.list_id
      AND l.deleted_at IS NULL
      AND is_band_member(l.band_id)
      AND (
        is_band_admin(l.band_id)
        OR l.created_by = (SELECT auth.uid())
        OR (
          band_list_items.item_type = 'member'
          AND band_list_items.member_user_id = (SELECT auth.uid())
          AND band_list_items.status = 'Anotado'
        )
      )
  )
);

DROP POLICY IF EXISTS band_list_items_delete_control_v2 ON public.band_list_items;
CREATE POLICY band_list_items_delete_control_v3
ON public.band_list_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.band_lists l
    WHERE l.id = band_list_items.list_id
      AND l.deleted_at IS NULL
      AND is_band_member(l.band_id)
      AND (
        is_band_admin(l.band_id)
        OR l.created_by = (SELECT auth.uid())
        OR (
          band_list_items.item_type = 'member'
          AND band_list_items.member_user_id = (SELECT auth.uid())
          AND band_list_items.status = 'Anotado'
        )
      )
  )
);

DROP POLICY IF EXISTS band_list_items_select_member ON public.band_list_items;
CREATE POLICY band_list_items_select_member_v2
ON public.band_list_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.band_lists l
    WHERE l.id = band_list_items.list_id
      AND is_band_member(l.band_id)
      AND (
        l.deleted_at IS NULL
        OR l.deleted_by = (SELECT auth.uid())
        OR is_band_admin(l.band_id)
      )
  )
  AND (
    song_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.band_lists l
      JOIN public.songs s ON s.band_id = l.band_id
      WHERE l.id = band_list_items.list_id
        AND s.id = band_list_items.song_id
    )
  )
  AND (
    member_user_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.band_lists l
      JOIN public.band_members bm ON bm.band_id = l.band_id
      WHERE l.id = band_list_items.list_id
        AND bm.user_id = band_list_items.member_user_id
        AND bm.active = true
    )
  )
);

DROP POLICY IF EXISTS band_list_managers_select_member ON public.band_list_managers;
CREATE POLICY band_list_managers_select_member_v2
ON public.band_list_managers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.band_lists l
    WHERE l.id = band_list_managers.list_id
      AND is_band_member(l.band_id)
      AND (
        l.deleted_at IS NULL
        OR l.deleted_by = (SELECT auth.uid())
        OR is_band_admin(l.band_id)
      )
  )
);

-- The client never needs to touch the audit log directly. Keep only the
-- authenticated SELECT grant; RLS still limits rows to band admins.
REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_log TO authenticated;

-- No anonymous client should have table privileges on BandaBase data tables.
REVOKE ALL ON TABLE
  public.band_members,
  public.band_lists,
  public.band_list_items,
  public.band_list_managers,
  public.proposals,
  public.proposal_options,
  public.proposal_votes,
  public.proposal_blocks,
  public.proposal_attachments,
  public.comments,
  public.comment_blocks,
  public.comment_attachments,
  public.materials,
  public.material_blocks,
  public.material_attachments,
  public.songs
FROM anon;

-- Authenticated clients retain operation grants used by the app/RLS,
-- but cannot perform DDL-adjacent table operations.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.band_members,
  public.band_lists,
  public.band_list_items,
  public.band_list_managers,
  public.proposals,
  public.proposal_options,
  public.proposal_votes,
  public.proposal_blocks,
  public.proposal_attachments,
  public.comments,
  public.comment_blocks,
  public.comment_attachments,
  public.materials,
  public.material_blocks,
  public.material_attachments,
  public.songs
FROM authenticated;
