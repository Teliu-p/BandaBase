DROP POLICY IF EXISTS band_members_can_manage_material_files
ON storage.objects;

CREATE POLICY material_files_select_member
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_band_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY material_files_insert_owner_or_admin
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id = ((storage.foldername(name))[2])::uuid
      AND m.band_id = ((storage.foldername(name))[1])::uuid
      AND (
        m.created_by = (SELECT auth.uid())
        OR is_band_admin(m.band_id)
      )
  )
);

CREATE POLICY material_files_update_owner_or_admin
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id = ((storage.foldername(name))[2])::uuid
      AND m.band_id = ((storage.foldername(name))[1])::uuid
      AND (
        m.created_by = (SELECT auth.uid())
        OR is_band_admin(m.band_id)
      )
  )
)
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id = ((storage.foldername(name))[2])::uuid
      AND m.band_id = ((storage.foldername(name))[1])::uuid
      AND (
        m.created_by = (SELECT auth.uid())
        OR is_band_admin(m.band_id)
      )
  )
);

CREATE POLICY material_files_delete_owner_or_admin
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id = ((storage.foldername(name))[2])::uuid
      AND m.band_id = ((storage.foldername(name))[1])::uuid
      AND (
        m.created_by = (SELECT auth.uid())
        OR is_band_admin(m.band_id)
      )
  )
);
