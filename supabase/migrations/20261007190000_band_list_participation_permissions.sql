create table if not exists public.band_list_managers (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.band_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create index if not exists band_list_managers_list_id_idx
  on public.band_list_managers(list_id);

create index if not exists band_list_managers_user_id_idx
  on public.band_list_managers(user_id);

create unique index if not exists band_list_items_one_member_per_list_idx
on public.band_list_items(list_id, member_user_id)
where item_type = 'member' and member_user_id is not null;

alter table public.band_list_managers enable row level security;

drop policy if exists band_list_managers_select_member on public.band_list_managers;
create policy band_list_managers_select_member
on public.band_list_managers
for select
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_managers.list_id
      and is_band_member(l.band_id)
  )
);

drop policy if exists band_list_managers_insert_creator on public.band_list_managers;
create policy band_list_managers_insert_creator
on public.band_list_managers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.band_lists l
    join public.band_members bm
      on bm.band_id = l.band_id
     and bm.user_id = band_list_managers.user_id
     and bm.active = true
    where l.id = band_list_managers.list_id
      and l.created_by = (select auth.uid())
  )
);

drop policy if exists band_list_managers_delete_creator on public.band_list_managers;
create policy band_list_managers_delete_creator
on public.band_list_managers
for delete
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_managers.list_id
      and l.created_by = (select auth.uid())
  )
);

drop policy if exists band_lists_band_access on public.band_lists;
drop policy if exists band_list_items_band_access on public.band_list_items;

drop policy if exists band_lists_select_member on public.band_lists;
create policy band_lists_select_member
on public.band_lists
for select
to authenticated
using (is_band_member(band_id));

drop policy if exists band_lists_insert_member_creator on public.band_lists;
create policy band_lists_insert_member_creator
on public.band_lists
for insert
to authenticated
with check (
  is_band_member(band_id)
  and created_by = (select auth.uid())
);

drop policy if exists band_lists_update_creator on public.band_lists;
create policy band_lists_update_creator
on public.band_lists
for update
to authenticated
using (
  created_by = (select auth.uid())
  and is_band_member(band_id)
)
with check (
  created_by = (select auth.uid())
  and is_band_member(band_id)
);

drop policy if exists band_lists_delete_creator on public.band_lists;
create policy band_lists_delete_creator
on public.band_lists
for delete
to authenticated
using (
  created_by = (select auth.uid())
  and is_band_member(band_id)
);

drop policy if exists band_list_items_select_member on public.band_list_items;
create policy band_list_items_select_member
on public.band_list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and is_band_member(l.band_id)
  )
  and (
    song_id is null
    or exists (
      select 1
      from public.songs s
      where s.id = band_list_items.song_id
        and s.band_id = l.band_id
    )
  )
  and (
    member_user_id is null
    or exists (
      select 1
      from public.band_lists l2
      join public.band_members bm on bm.band_id = l2.band_id
      where l2.id = band_list_items.list_id
        and bm.user_id = band_list_items.member_user_id
        and bm.active = true
    )
  )
);

drop policy if exists band_list_items_insert_control on public.band_list_items;
create policy band_list_items_insert_control
on public.band_list_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and is_band_member(l.band_id)
      and (
        (
          l.created_by = (select auth.uid())
          and (
            band_list_items.song_id is null
            or exists (
              select 1
              from public.songs s
              where s.id = band_list_items.song_id
                and s.band_id = l.band_id
            )
          )
          and (
            band_list_items.member_user_id is null
            or exists (
              select 1
              from public.band_members bm
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
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = (select auth.uid())
              and bm.active = true
          )
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado','Confirmado')
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and (
                l.created_by = (select auth.uid())
                or m.user_id = (select auth.uid())
              )
          )
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = band_list_items.member_user_id
              and bm.active = true
          )
        )
      )
  )
);

drop policy if exists band_list_items_update_control on public.band_list_items;
create policy band_list_items_update_control
on public.band_list_items
for update
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and is_band_member(l.band_id)
      and (
        l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and is_band_member(l.band_id)
      and (
        (
          l.created_by = (select auth.uid())
          and (
            band_list_items.song_id is null
            or exists (
              select 1
              from public.songs s
              where s.id = band_list_items.song_id
                and s.band_id = l.band_id
            )
          )
          and (
            band_list_items.member_user_id is null
            or exists (
              select 1
              from public.band_members bm
              where bm.band_id = l.band_id
                and bm.user_id = band_list_items.member_user_id
                and bm.active = true
            )
          )
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado','Confirmado')
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and (
                l.created_by = (select auth.uid())
                or m.user_id = (select auth.uid())
              )
          )
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = l.band_id
              and bm.user_id = band_list_items.member_user_id
              and bm.active = true
          )
        )
      )
  )
);

drop policy if exists band_list_items_delete_control on public.band_list_items;
create policy band_list_items_delete_control
on public.band_list_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and is_band_member(l.band_id)
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
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and m.user_id = (select auth.uid())
          )
        )
      )
  )
);

update public.band_list_items
set status = case
  when status in ('Confirmado','Presente') then 'Confirmado'
  else 'Anotado'
end
where item_type = 'member';

grant select, insert, update, delete
on table public.band_list_managers
to authenticated;
