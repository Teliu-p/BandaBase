
create table if not exists public.material_blocks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  block_type text not null check (block_type in ('text', 'attachment')),
  content text null,
  attachment_id uuid null references public.material_attachments(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint material_blocks_type_shape_chk check (
    (block_type = 'text' and attachment_id is null)
    or
    (block_type = 'attachment' and attachment_id is not null and content is null)
  ),
  unique (material_id, position)
);

create index if not exists material_blocks_material_position_idx
  on public.material_blocks(material_id, position);

create index if not exists material_attachments_material_id_idx
  on public.material_attachments(material_id);

create index if not exists materials_song_id_idx
  on public.materials(song_id);

alter table public.material_blocks enable row level security;

drop policy if exists "material_blocks_band_access" on public.material_blocks;

create policy "material_blocks_band_access"
  on public.material_blocks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.materials m
      where m.id = material_blocks.material_id
        and is_band_member(m.band_id)
    )
  )
  with check (
    exists (
      select 1
      from public.materials m
      where m.id = material_blocks.material_id
        and is_band_member(m.band_id)
    )
  );

grant select, insert, update, delete on public.material_blocks to authenticated;

insert into public.material_blocks (
  material_id,
  block_type,
  content,
  position
)
select
  m.id,
  'text',
  coalesce(m.content, ''),
  0
from public.materials m
where not exists (
  select 1
  from public.material_blocks mb
  where mb.material_id = m.id
);

create table if not exists public.band_lists (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null,
  list_date date null,
  list_time time without time zone null,
  event_type text null,
  status text not null default 'Planificada'
    check (status in ('Planificada', 'Confirmada', 'Realizada', 'Cancelada')),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists band_lists_band_date_time_idx
  on public.band_lists(band_id, list_date desc, list_time desc);

alter table public.band_lists enable row level security;

drop policy if exists "band_lists_band_access" on public.band_lists;

create policy "band_lists_band_access"
  on public.band_lists
  for all
  to authenticated
  using (is_band_member(band_id))
  with check (is_band_member(band_id));

grant select, insert, update, delete on public.band_lists to authenticated;

create table if not exists public.band_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.band_lists(id) on delete cascade,
  item_type text not null check (
    item_type in ('song', 'member', 'task', 'equipment', 'material', 'pending')
  ),
  title text not null,
  details text null,
  song_id uuid null references public.songs(id) on delete cascade,
  member_user_id uuid null references auth.users(id) on delete cascade,
  status text null,
  position integer not null default 0 check (position >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists band_list_items_list_position_idx
  on public.band_list_items(list_id, position);

create index if not exists band_list_items_song_id_idx
  on public.band_list_items(song_id);

create index if not exists band_list_items_member_user_id_idx
  on public.band_list_items(member_user_id);

alter table public.band_list_items enable row level security;

drop policy if exists "band_list_items_band_access" on public.band_list_items;

create policy "band_list_items_band_access"
  on public.band_list_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.band_lists l
      where l.id = band_list_items.list_id
        and is_band_member(l.band_id)
    )
    and (
      band_list_items.song_id is null
      or exists (
        select 1
        from public.band_lists l
        join public.songs s on s.band_id = l.band_id
        where l.id = band_list_items.list_id
          and s.id = band_list_items.song_id
      )
    )
    and (
      band_list_items.member_user_id is null
      or exists (
        select 1
        from public.band_lists l
        join public.band_members bm on bm.band_id = l.band_id
        where l.id = band_list_items.list_id
          and bm.user_id = band_list_items.member_user_id
          and bm.active = true
      )
    )
  )
  with check (
    exists (
      select 1
      from public.band_lists l
      where l.id = band_list_items.list_id
        and is_band_member(l.band_id)
    )
    and (
      band_list_items.song_id is null
      or exists (
        select 1
        from public.band_lists l
        join public.songs s on s.band_id = l.band_id
        where l.id = band_list_items.list_id
          and s.id = band_list_items.song_id
      )
    )
    and (
      band_list_items.member_user_id is null
      or exists (
        select 1
        from public.band_lists l
        join public.band_members bm on bm.band_id = l.band_id
        where l.id = band_list_items.list_id
          and bm.user_id = band_list_items.member_user_id
          and bm.active = true
      )
    )
  );

grant select, insert, update, delete on public.band_list_items to authenticated;
