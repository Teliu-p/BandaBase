\set ON_ERROR_STOP on

-- Runs after band_list_item_self_service_fixture.sql in the same disposable DB.
-- Reuse its authenticated roles, auth.uid(), band_members, and membership helpers.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

INSERT INTO public.songs (id, band_id)
VALUES (
  '30000000-0000-0000-0000-000000000004',
  '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.songs
SET deleted_at = NULL,
    deleted_by = NULL;

-- Member 2 trashed their own song. Member 4 trashed a different song.
UPDATE public.songs
SET deleted_at = '2026-11-01T00:00:00Z',
    deleted_by = '10000000-0000-0000-0000-000000000002'
WHERE id = '30000000-0000-0000-0000-000000000002';

UPDATE public.songs
SET deleted_at = '2026-11-02T00:00:00Z',
    deleted_by = '10000000-0000-0000-0000-000000000004'
WHERE id = '30000000-0000-0000-0000-000000000004';

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.songs TO authenticated;

DROP POLICY IF EXISTS songs_select_active_or_admin ON public.songs;
DROP POLICY IF EXISTS songs_select_active_or_own_trash_or_admin ON public.songs;

CREATE POLICY songs_select_active_or_admin
ON public.songs
FOR SELECT
TO authenticated
USING (
  public.is_band_member(band_id)
  AND (
    deleted_at IS NULL
    OR public.is_band_admin(band_id)
  )
);

CREATE POLICY songs_select_active_or_own_trash_or_admin
ON public.songs
FOR SELECT
TO authenticated
USING (
  public.is_band_member(band_id)
  AND (
    deleted_at IS NULL
    OR deleted_by = (SELECT auth.uid())
    OR public.is_band_admin(band_id)
  )
);
