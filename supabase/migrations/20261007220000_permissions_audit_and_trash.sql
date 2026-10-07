create schema if not exists private;

alter table public.songs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.band_lists
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.proposals
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.comments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists songs_deleted_at_idx
  on public.songs (band_id, deleted_at);

create index if not exists band_lists_deleted_at_idx
  on public.band_lists (band_id, deleted_at);

create index if not exists proposals_deleted_at_idx
  on public.proposals (band_id, deleted_at);

create index if not exists comments_deleted_at_idx
  on public.comments (band_id, deleted_at);

alter table public.band_members
drop constraint if exists band_members_role_check;

alter table public.band_members
add constraint band_members_role_check
check (role in ('member', 'admin', 'owner'));

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create','update','trash','restore','delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_band_created_idx
  on public.audit_log (band_id, created_at desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, created_at desc);

create index if not exists audit_log_actor_idx
  on public.audit_log (actor_user_id, created_at desc);

alter table public.audit_log enable row level security;

create or replace function public.is_band_admin(p_band_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.band_members bm
    where bm.band_id = p_band_id
      and bm.user_id = (select auth.uid())
      and bm.active = true
      and bm.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_band_admin(uuid) from public;
grant execute on function public.is_band_admin(uuid) to authenticated;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_band_id uuid;
  v_old_deleted timestamptz;
  v_new_deleted timestamptz;
  v_action text;
  v_entity_type text;
begin
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
  else
    v_old := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
    v_new := to_jsonb(NEW);
  end if;

  if TG_TABLE_NAME = 'proposal_options' then
    return coalesce(NEW, OLD);
  end if;

  v_entity_type := TG_TABLE_NAME;

  if TG_TABLE_NAME = 'band_list_items'
     and coalesce(v_new->>'item_type', v_old->>'item_type') <> 'member' then
    return coalesce(NEW, OLD);
  end if;

  if TG_TABLE_NAME in ('band_lists','songs','proposals','comments','band_members') then
    v_band_id := coalesce(
      nullif(v_new->>'band_id','')::uuid,
      nullif(v_old->>'band_id','')::uuid
    );
  elsif TG_TABLE_NAME in ('band_list_items','band_list_managers') then
    v_band_id := (
      select l.band_id
      from public.band_lists l
      where l.id = coalesce(
        nullif(v_new->>'list_id','')::uuid,
        nullif(v_old->>'list_id','')::uuid
      )
    );
  else
    return coalesce(NEW, OLD);
  end if;

  if TG_OP <> 'INSERT' then
    v_old_deleted := nullif(v_old->>'deleted_at','')::timestamptz;
  end if;

  if TG_OP <> 'DELETE' then
    v_new_deleted := nullif(v_new->>'deleted_at','')::timestamptz;
  end if;

  if TG_OP = 'INSERT' then
    v_action := 'create';
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
  elsif v_old_deleted is null and v_new_deleted is not null then
    v_action := 'trash';
  elsif v_old_deleted is not null and v_new_deleted is null then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;

  if v_band_id is not null then
    insert into public.audit_log (
      band_id, actor_user_id, entity_type, entity_id, action,
      before_data, after_data
    )
    values (
      v_band_id,
      (select auth.uid()),
      v_entity_type,
      coalesce(
        nullif(v_new->>'id','')::uuid,
        nullif(v_old->>'id','')::uuid
      ),
      v_action,
      v_old,
      v_new
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;

revoke all on function private.write_audit_log() from public, anon, authenticated;

drop trigger if exists audit_songs on public.songs;
create trigger audit_songs
after insert or update or delete on public.songs
for each row execute function private.write_audit_log();

drop trigger if exists audit_band_lists on public.band_lists;
create trigger audit_band_lists
after insert or update or delete on public.band_lists
for each row execute function private.write_audit_log();

drop trigger if exists audit_proposals on public.proposals;
create trigger audit_proposals
after insert or update or delete on public.proposals
for each row execute function private.write_audit_log();

drop trigger if exists audit_comments on public.comments;
create trigger audit_comments
after insert or update or delete on public.comments
for each row execute function private.write_audit_log();

drop trigger if exists audit_band_members on public.band_members;
create trigger audit_band_members
after insert or update or delete on public.band_members
for each row execute function private.write_audit_log();

drop trigger if exists audit_band_list_items on public.band_list_items;
create trigger audit_band_list_items
after insert or update or delete on public.band_list_items
for each row execute function private.write_audit_log();

drop trigger if exists audit_band_list_managers on public.band_list_managers;
create trigger audit_band_list_managers
after insert or update or delete on public.band_list_managers
for each row execute function private.write_audit_log();

drop trigger if exists audit_proposal_options on public.proposal_options;
create trigger audit_proposal_options
after insert or update or delete on public.proposal_options
for each row execute function private.write_audit_log();

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
on public.audit_log
for select
to authenticated
using (public.is_band_admin(band_id));

drop policy if exists band_members_update_owner on public.band_members;
create policy band_members_update_owner
on public.band_members
for update
to authenticated
using (
  user_id <> (select auth.uid())
  and exists (
    select 1
    from public.band_members owner_row
    where owner_row.band_id = band_members.band_id
      and owner_row.user_id = (select auth.uid())
      and owner_row.active = true
      and owner_row.role = 'owner'
  )
)
with check (role in ('member','admin'));

drop policy if exists songs_band_access on public.songs;
drop policy if exists band_members_can_insert_songs on public.songs;

create policy songs_select_active_or_admin
on public.songs
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy songs_insert_member
on public.songs
for insert
to authenticated
with check (is_band_member(band_id));

create policy songs_update_member_or_admin
on public.songs
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy songs_delete_admin
on public.songs
for delete
to authenticated
using (public.is_band_admin(band_id));

drop policy if exists band_lists_select_member on public.band_lists;
drop policy if exists band_lists_insert_member_creator on public.band_lists;
drop policy if exists band_lists_update_creator on public.band_lists;
drop policy if exists band_lists_delete_creator on public.band_lists;

create policy band_lists_select_member_or_admin
on public.band_lists
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy band_lists_insert_member_creator
on public.band_lists
for insert
to authenticated
with check (
  is_band_member(band_id)
  and created_by = (select auth.uid())
);

create policy band_lists_update_creator_or_admin
on public.band_lists
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy band_lists_delete_admin
on public.band_lists
for delete
to authenticated
using (public.is_band_admin(band_id));

drop policy if exists band_list_items_insert_control on public.band_list_items;
drop policy if exists band_list_items_update_control on public.band_list_items;
drop policy if exists band_list_items_delete_control on public.band_list_items;

create policy band_list_items_insert_control_v2
on public.band_list_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = (select auth.uid())
          and band_list_items.status = 'Anotado'
        )
        or (
          band_list_items.item_type = 'member'
          and band_list_items.status in ('Anotado','Confirmado')
          and exists (
            select 1
            from public.band_list_managers m
            where m.list_id = l.id
              and (
                m.user_id = (select auth.uid())
                or l.created_by = (select auth.uid())
              )
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
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
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
      and l.deleted_at is null
      and is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
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

create policy band_list_items_delete_control_v2
on public.band_list_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = (select auth.uid())
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

drop policy if exists band_list_managers_insert_creator on public.band_list_managers;
drop policy if exists band_list_managers_delete_creator on public.band_list_managers;

create policy band_list_managers_insert_creator_or_admin
on public.band_list_managers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.band_lists l
    where l.id = band_list_managers.list_id
      and l.deleted_at is null
      and (
        l.created_by = (select auth.uid())
        or public.is_band_admin(l.band_id)
      )
  )
);

create policy band_list_managers_delete_creator_or_admin
on public.band_list_managers
for delete
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_managers.list_id
      and (
        l.created_by = (select auth.uid())
        or public.is_band_admin(l.band_id)
      )
  )
);

drop policy if exists proposals_band_access on public.proposals;

create policy proposals_select_active_or_admin
on public.proposals
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy proposals_insert_member
on public.proposals
for insert
to authenticated
with check (
  is_band_member(band_id)
  and created_by = (select auth.uid())
);

create policy proposals_update_owner_or_admin
on public.proposals
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    created_by = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy proposals_delete_admin
on public.proposals
for delete
to authenticated
using (public.is_band_admin(band_id));

drop policy if exists proposal_options_band_access on public.proposal_options;
drop policy if exists proposal_blocks_band_access on public.proposal_blocks;
drop policy if exists proposal_attachments_band_access on public.proposal_attachments;

create policy proposal_options_select_member
on public.proposal_options
for select
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_options.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
);

create policy proposal_options_write_owner_or_admin
on public.proposal_options
for all
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_options.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_options.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
);

create policy proposal_blocks_select_member
on public.proposal_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_blocks.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
);

create policy proposal_blocks_write_owner_or_admin
on public.proposal_blocks
for all
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_blocks.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_blocks.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
);

create policy proposal_attachments_select_member
on public.proposal_attachments
for select
to authenticated
using (
  is_band_member(band_id)
  and exists (
    select 1
    from public.proposals p
    where p.id = proposal_attachments.proposal_id
      and p.deleted_at is null
      and p.band_id = proposal_attachments.band_id
  )
);

create policy proposal_attachments_write_owner_or_admin
on public.proposal_attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_attachments.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_attachments.proposal_id
      and p.deleted_at is null
      and (
        p.created_by = (select auth.uid())
        or public.is_band_admin(p.band_id)
      )
  )
);

drop policy if exists proposal_votes_band_access on public.proposal_votes;

create policy proposal_votes_select_member
on public.proposal_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.proposals p
    where p.id = proposal_votes.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
);

create policy proposal_votes_insert_own
on public.proposal_votes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.proposals p
    join public.proposal_options o on o.proposal_id = p.id
    where p.id = proposal_votes.proposal_id
      and o.id = proposal_votes.option_id
      and p.deleted_at is null
      and p.status = 'Abierta'
      and is_band_member(p.band_id)
  )
);

create policy proposal_votes_update_own
on public.proposal_votes
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.proposals p
    where p.id = proposal_votes.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.proposals p
    join public.proposal_options o on o.proposal_id = p.id
    where p.id = proposal_votes.proposal_id
      and o.id = proposal_votes.option_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
);

create policy proposal_votes_delete_own
on public.proposal_votes
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.proposals p
    where p.id = proposal_votes.proposal_id
      and p.deleted_at is null
      and is_band_member(p.band_id)
  )
);

drop policy if exists comments_member_insert on public.comments;
drop policy if exists comments_member_update_own on public.comments;
drop policy if exists comments_song_member_delete_own on public.comments;
drop policy if exists comments_song_select on public.comments;

create policy comments_select_active_or_admin
on public.comments
for select
to authenticated
using (
  is_band_member(band_id)
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy comments_insert_own
on public.comments
for insert
to authenticated
with check (
  is_band_member(band_id)
  and user_id = (select auth.uid())
  and (
    song_id is null
    or exists (
      select 1
      from public.songs s
      where s.id = comments.song_id
        and s.band_id = comments.band_id
        and s.deleted_at is null
    )
  )
);

create policy comments_update_own_or_admin
on public.comments
for update
to authenticated
using (
  is_band_member(band_id)
  and (
    user_id = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
)
with check (
  is_band_member(band_id)
  and (
    user_id = (select auth.uid())
    or public.is_band_admin(band_id)
  )
  and (
    deleted_at is null
    or public.is_band_admin(band_id)
  )
);

create policy comments_delete_admin
on public.comments
for delete
to authenticated
using (public.is_band_admin(band_id));

drop policy if exists comments_update_blocks_owner_or_admin on public.comment_blocks;
drop policy if exists comments_attachments_owner_or_admin on public.comment_attachments;

create policy comment_blocks_select_member
on public.comment_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and c.deleted_at is null
      and is_band_member(c.band_id)
  )
);

create policy comment_blocks_insert_owner_or_admin
on public.comment_blocks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);

create policy comment_blocks_update_owner_or_admin
on public.comment_blocks
for update
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);

create policy comment_blocks_delete_owner_or_admin
on public.comment_blocks
for delete
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_blocks.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);

create policy comment_attachments_select_member
on public.comment_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.deleted_at is null
      and is_band_member(c.band_id)
  )
);

create policy comment_attachments_insert_owner_or_admin
on public.comment_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);

create policy comment_attachments_update_owner_or_admin
on public.comment_attachments
for update
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);

create policy comment_attachments_delete_owner_or_admin
on public.comment_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_attachments.comment_id
      and c.deleted_at is null
      and (
        c.user_id = (select auth.uid())
        or public.is_band_admin(c.band_id)
      )
  )
);
