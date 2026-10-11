\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

create function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

create table public.band_members (
  band_id uuid not null,
  user_id uuid not null,
  active boolean not null,
  role text not null
);

create table public.band_lists (
  id uuid primary key,
  band_id uuid not null,
  created_by uuid not null,
  deleted_at timestamptz
);

create table public.songs (
  id uuid primary key,
  band_id uuid not null
);

create table public.band_list_managers (
  list_id uuid not null,
  user_id uuid not null
);

create table public.band_list_items (
  id uuid primary key,
  list_id uuid not null,
  item_type text not null,
  title text not null,
  details text,
  song_id uuid,
  member_user_id uuid,
  status text,
  position integer not null default 0,
  participation_instruments text[] not null default '{}',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint band_list_items_item_type_check
    check (item_type = any (array['song','member']::text[])),
  constraint band_list_items_member_status_check
    check (item_type = 'song' or status = any (array['Anotado','Confirmado']::text[])),
  constraint band_list_items_participation_instruments_check
    check (participation_instruments <@ array['guitar','voice','keyboard','bass','drums']::text[]),
  constraint band_list_items_shape_check
    check (
      (item_type = 'song'
        and song_id is not null
        and member_user_id is null
        and cardinality(coalesce(participation_instruments, '{}'::text[])) = 0)
      or
      (item_type = 'member'
        and member_user_id is not null
        and song_id is null)
    ),
  constraint band_list_items_position_check check (position >= 0)
);

create unique index band_list_items_one_member_per_list_idx
  on public.band_list_items (list_id, member_user_id)
  where item_type = 'member' and member_user_id is not null;

create function public.is_band_member(p_band_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $function$
  select exists (
    select 1 from public.band_members bm
    where bm.band_id = p_band_id
      and bm.user_id = (select auth.uid())
      and bm.active = true
  );
$function$;

create function public.is_band_admin(p_band_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $function$
  select exists (
    select 1 from public.band_members bm
    where bm.band_id = p_band_id
      and bm.user_id = (select auth.uid())
      and bm.active = true
      and bm.role in ('owner','admin')
  );
$function$;

create function private.prevent_manager_list_item_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_band_id uuid;
begin
  if old.item_type <> 'member' then
    return new;
  end if;

  select l.band_id into v_band_id
  from public.band_lists l
  where l.id = old.list_id;

  if v_band_id is null
     or public.is_band_admin(v_band_id)
     or exists (
       select 1 from public.band_lists l
       where l.id = old.list_id
         and l.created_by = (select auth.uid())
     ) then
    return new;
  end if;

  if exists (
    select 1 from public.band_list_managers m
    where m.list_id = old.list_id
      and m.user_id = (select auth.uid())
  ) then
    if old.list_id is distinct from new.list_id
       or old.item_type is distinct from new.item_type
       or old.title is distinct from new.title
       or old.details is distinct from new.details
       or old.song_id is distinct from new.song_id
       or old.member_user_id is distinct from new.member_user_id
       or old.participation_instruments is distinct from new.participation_instruments
       or old.position is distinct from new.position
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Los responsables solo pueden cambiar la participación del integrante.';
    end if;

    if new.status not in ('Anotado', 'Confirmado') then
      raise exception 'Estado de participación inválido.';
    end if;

    return new;
  end if;

  return new;
end;
$function$;

create trigger manager_list_item_edit_guard
before update on public.band_list_items
for each row execute function private.prevent_manager_list_item_edit();

insert into public.band_members (band_id,user_id,active,role) values
  ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001',true,'admin'),
  ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002',true,'member'),
  ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000003',true,'member'),
  ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000004',true,'member'),
  ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000005',false,'member'),
  ('22222222-2222-2222-2222-222222222222','10000000-0000-0000-0000-000000000006',true,'member');

insert into public.band_lists (id,band_id,created_by,deleted_at) values
  ('40000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002',null),
  ('40000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000002',now());

insert into public.songs (id,band_id) values
  ('30000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),
  ('30000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111'),
  ('30000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222');

insert into public.band_list_managers (list_id,user_id) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004');

insert into public.band_list_items
  (id,list_id,item_type,title,song_id,member_user_id,status,position,participation_instruments,created_by)
values
  ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','song','Canción de la banda','30000000-0000-0000-0000-000000000001',null,null,0,'{}','10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','member','Integrante propio',null,'10000000-0000-0000-0000-000000000003','Anotado',1,array['guitar'],'10000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','member','Integrante participante',null,'10000000-0000-0000-0000-000000000002','Anotado',2,array['voice'],'10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','song','Canción en papelera','30000000-0000-0000-0000-000000000001',null,null,0,'{}','10000000-0000-0000-0000-000000000002');

alter table public.band_list_items enable row level security;

grant usage on schema public, auth, private to authenticated;
grant select on public.band_lists, public.songs, public.band_members, public.band_list_managers, public.band_list_items to authenticated;
grant update on public.band_list_items to authenticated;
grant execute on function auth.uid() to authenticated;

create policy band_list_items_select_member_v2
on public.band_list_items
for select
to authenticated
using (
  exists (
    select 1 from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
  )
);

-- Model the two permissive UPDATE policies observed in production before repair.
create policy band_list_items_update_control
on public.band_list_items
for update
to authenticated
using (
  exists (
    select 1 from public.band_lists l
    where l.id = band_list_items.list_id
      and public.is_band_member(l.band_id)
      and (
        l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
        )
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1 from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
)
with check (
  exists (
    select 1 from public.band_lists l
    where l.id = band_list_items.list_id
      and public.is_band_member(l.band_id)
      and (
        (
          l.created_by = (select auth.uid())
          and (
            band_list_items.song_id is null
            or exists (
              select 1 from public.songs s
              where s.id = band_list_items.song_id
                and s.band_id = l.band_id
            )
          )
          and (
            band_list_items.member_user_id is null
            or exists (
              select 1 from public.band_members bm
              where bm.band_id = l.band_id
                and bm.user_id = band_list_items.member_user_id
                and bm.active = true
            )
          )
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
          and cardinality(band_list_items.participation_instruments) > 0
          and band_list_items.participation_instruments
            <@ array['guitar','voice','keyboard','bass','drums']::text[]
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado','Confirmado')
          and exists (
            select 1 from public.band_list_managers m
            where m.list_id = l.id
              and (
                l.created_by = (select auth.uid())
                or m.user_id = (select auth.uid())
              )
          )
          and exists (
            select 1 from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = band_list_items.member_user_id
              and bm.active = true
          )
        )
      )
  )
);

create policy band_list_items_update_control_v2
on public.band_list_items
for update
to authenticated
using (
  exists (
    select 1 from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1 from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
)
with check (
  exists (
    select 1 from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1 from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
);
