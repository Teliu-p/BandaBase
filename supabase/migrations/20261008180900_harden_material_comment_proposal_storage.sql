-- Keep Storage authorization aligned with BandaBase's supported file path shapes:
--   band_id/material_id/...
--   band_id/comments/comment_id/...
--   band_id/proposals/proposal_id/...

drop policy if exists material_files_select_member on storage.objects;
drop policy if exists material_files_insert_owner_or_admin on storage.objects;
drop policy if exists material_files_update_owner_or_admin on storage.objects;
drop policy if exists material_files_delete_owner_or_admin on storage.objects;

create policy material_files_select_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'materials'
  and (storage.foldername(objects.name))[1] is not null
  and is_band_member(((storage.foldername(objects.name))[1])::uuid)
);

create policy material_files_insert_owner_or_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'materials'
  and (
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] is not null
      and exists (
        select 1
        from public.materials m
        where m.id = ((storage.foldername(objects.name))[2])::uuid
          and m.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (m.created_by = (select auth.uid()) or is_band_admin(m.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'comments'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1
        from public.comments c
        where c.id = ((storage.foldername(objects.name))[3])::uuid
          and c.band_id = ((storage.foldername(objects.name))[1])::uuid
          and c.deleted_at is null
          and (c.user_id = (select auth.uid()) or is_band_admin(c.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'proposals'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1
        from public.proposals p
        where p.id = ((storage.foldername(objects.name))[3])::uuid
          and p.band_id = ((storage.foldername(objects.name))[1])::uuid
          and p.deleted_at is null
          and (p.created_by = (select auth.uid()) or is_band_admin(p.band_id))
      )
    )
  )
);

create policy material_files_update_owner_or_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'materials'
  and (
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] is not null
      and exists (
        select 1 from public.materials m
        where m.id = ((storage.foldername(objects.name))[2])::uuid
          and m.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (m.created_by = (select auth.uid()) or is_band_admin(m.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'comments'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.comments c
        where c.id = ((storage.foldername(objects.name))[3])::uuid
          and c.band_id = ((storage.foldername(objects.name))[1])::uuid
          and c.deleted_at is null
          and (c.user_id = (select auth.uid()) or is_band_admin(c.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'proposals'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.proposals p
        where p.id = ((storage.foldername(objects.name))[3])::uuid
          and p.band_id = ((storage.foldername(objects.name))[1])::uuid
          and p.deleted_at is null
          and (p.created_by = (select auth.uid()) or is_band_admin(p.band_id))
      )
    )
  )
)
with check (
  bucket_id = 'materials'
  and (
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] is not null
      and exists (
        select 1 from public.materials m
        where m.id = ((storage.foldername(objects.name))[2])::uuid
          and m.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (m.created_by = (select auth.uid()) or is_band_admin(m.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'comments'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.comments c
        where c.id = ((storage.foldername(objects.name))[3])::uuid
          and c.band_id = ((storage.foldername(objects.name))[1])::uuid
          and c.deleted_at is null
          and (c.user_id = (select auth.uid()) or is_band_admin(c.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'proposals'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.proposals p
        where p.id = ((storage.foldername(objects.name))[3])::uuid
          and p.band_id = ((storage.foldername(objects.name))[1])::uuid
          and p.deleted_at is null
          and (p.created_by = (select auth.uid()) or is_band_admin(p.band_id))
      )
    )
  )
);

create policy material_files_delete_owner_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'materials'
  and (
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] is not null
      and exists (
        select 1 from public.materials m
        where m.id = ((storage.foldername(objects.name))[2])::uuid
          and m.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (m.created_by = (select auth.uid()) or is_band_admin(m.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'comments'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.comments c
        where c.id = ((storage.foldername(objects.name))[3])::uuid
          and c.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (c.user_id = (select auth.uid()) or is_band_admin(c.band_id))
      )
    )
    or
    (
      (storage.foldername(objects.name))[1] is not null
      and (storage.foldername(objects.name))[2] = 'proposals'
      and (storage.foldername(objects.name))[3] is not null
      and exists (
        select 1 from public.proposals p
        where p.id = ((storage.foldername(objects.name))[3])::uuid
          and p.band_id = ((storage.foldername(objects.name))[1])::uuid
          and (p.created_by = (select auth.uid()) or is_band_admin(p.band_id))
      )
    )
  )
);
