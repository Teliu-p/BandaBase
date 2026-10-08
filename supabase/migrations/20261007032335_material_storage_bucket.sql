
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;

create policy "band_members_can_manage_material_files"
  on storage.objects
  as permissive
  for all
  to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] is not null
    and public.is_band_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] is not null
    and public.is_band_member(((storage.foldername(name))[1])::uuid)
  );
