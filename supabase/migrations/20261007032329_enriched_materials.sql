
alter table public.materials
  add column if not exists content text;

create table if not exists public.material_attachments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  name text not null,
  url text,
  storage_path text,
  mime_type text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint material_attachments_source_check check (
    (kind = 'link' and url is not null and storage_path is null)
    or
    (kind = 'file' and storage_path is not null and url is null)
  )
);

create index if not exists material_attachments_material_id_idx
  on public.material_attachments(material_id);

alter table public.material_attachments enable row level security;

create policy "material_attachments_band_access"
  on public.material_attachments
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.materials m
      where m.id = material_attachments.material_id
        and public.is_band_member(m.band_id)
    )
  )
  with check (
    exists (
      select 1
      from public.materials m
      where m.id = material_attachments.material_id
        and public.is_band_member(m.band_id)
    )
  );
