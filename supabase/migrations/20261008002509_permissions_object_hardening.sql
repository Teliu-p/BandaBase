-- BandaBase: cierre de permisos por objeto y materiales
-- Applied to production as: 20261008002509_permissions_object_hardening

drop policy if exists songs_insert_member on public.songs;
drop policy if exists songs_update_active on public.songs;
drop policy if exists songs_trash_member on public.songs;
drop policy if exists songs_update_member_or_admin on public.songs;

create policy songs_insert_own on public.songs for insert to authenticated
with check (is_band_member(band_id) and created_by = (select auth.uid()));

create policy songs_update_own_or_admin on public.songs for update to authenticated
using (is_band_member(band_id) and deleted_at is null and (created_by = (select auth.uid()) or public.is_band_admin(band_id)))
with check (is_band_member(band_id) and deleted_at is null and (created_by = (select auth.uid()) or public.is_band_admin(band_id)));

drop policy if exists songs_select_active_or_admin on public.songs;
create policy songs_select_active_or_admin on public.songs for select to authenticated
using (is_band_member(band_id) and (deleted_at is null or public.is_band_admin(band_id)));

create policy songs_trash_own_or_admin on public.songs for update to authenticated
using (is_band_member(band_id) and deleted_at is null and (created_by = (select auth.uid()) or public.is_band_admin(band_id)))
with check (is_band_member(band_id) and deleted_at is not null and deleted_by = (select auth.uid()) and (created_by = (select auth.uid()) or public.is_band_admin(band_id)));

drop policy if exists materials_band_access on public.materials;
create policy materials_select_member on public.materials for select to authenticated using (is_band_member(band_id));
create policy materials_insert_own on public.materials for insert to authenticated with check (is_band_member(band_id) and created_by = (select auth.uid()));
create policy materials_update_own_or_admin on public.materials for update to authenticated
using (is_band_member(band_id) and (created_by = (select auth.uid()) or public.is_band_admin(band_id)))
with check (is_band_member(band_id) and (created_by = (select auth.uid()) or public.is_band_admin(band_id)));
create policy materials_delete_own_or_admin on public.materials for delete to authenticated
using (is_band_member(band_id) and (created_by = (select auth.uid()) or public.is_band_admin(band_id)));

drop policy if exists material_blocks_band_access on public.material_blocks;
create policy material_blocks_select_member on public.material_blocks for select to authenticated
using (exists (select 1 from public.materials m where m.id = material_blocks.material_id and is_band_member(m.band_id)));
create policy material_blocks_write_owner_or_admin on public.material_blocks for all to authenticated
using (exists (select 1 from public.materials m where m.id = material_blocks.material_id and (m.created_by = (select auth.uid()) or public.is_band_admin(m.band_id))))
with check (exists (select 1 from public.materials m where m.id = material_blocks.material_id and (m.created_by = (select auth.uid()) or public.is_band_admin(m.band_id))));

drop policy if exists material_attachments_band_access on public.material_attachments;
create policy material_attachments_select_member on public.material_attachments for select to authenticated
using (exists (select 1 from public.materials m where m.id = material_attachments.material_id and is_band_member(m.band_id)));
create policy material_attachments_write_owner_or_admin on public.material_attachments for all to authenticated
using (exists (select 1 from public.materials m where m.id = material_attachments.material_id and (m.created_by = (select auth.uid()) or public.is_band_admin(m.band_id))))
with check (exists (select 1 from public.materials m where m.id = material_attachments.material_id and (m.created_by = (select auth.uid()) or public.is_band_admin(m.band_id))));

create or replace function private.prevent_manager_list_item_edit()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_band_id uuid;
begin
  if old.item_type <> 'member' then return new; end if;
  select l.band_id into v_band_id from public.band_lists l where l.id = old.list_id;
  if v_band_id is null or public.is_band_admin(v_band_id)
     or exists (select 1 from public.band_lists l where l.id = old.list_id and l.created_by = (select auth.uid())) then return new; end if;
  if exists (select 1 from public.band_list_managers m where m.list_id = old.list_id and m.user_id = (select auth.uid())) then
    if old.list_id is distinct from new.list_id or old.item_type is distinct from new.item_type
       or old.title is distinct from new.title or old.details is distinct from new.details
       or old.song_id is distinct from new.song_id or old.member_user_id is distinct from new.member_user_id
       or old.position is distinct from new.position or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Los responsables solo pueden cambiar la confirmación del integrante.';
    end if;
    if new.status not in ('Anotado', 'Confirmado') then raise exception 'Estado de participación inválido.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_manager_list_item_edit() from public, anon, authenticated;
drop trigger if exists manager_list_item_edit_guard on public.band_list_items;
create trigger manager_list_item_edit_guard before update on public.band_list_items for each row execute function private.prevent_manager_list_item_edit();

create or replace function private.write_audit_log()
returns trigger language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_old jsonb; v_new jsonb; v_band_id uuid; v_old_deleted timestamptz;
  v_new_deleted timestamptz; v_action text; v_entity_type text; v_parent_material_id uuid;
begin
  if TG_OP = 'DELETE' then v_old := to_jsonb(OLD); v_new := null;
  else v_old := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end; v_new := to_jsonb(NEW); end if;
  if TG_TABLE_NAME = 'proposal_options' then return coalesce(NEW, OLD); end if;
  v_entity_type := TG_TABLE_NAME;
  if TG_TABLE_NAME = 'band_list_items' and coalesce(v_new->>'item_type', v_old->>'item_type') <> 'member' then return coalesce(NEW, OLD); end if;
  if TG_TABLE_NAME in ('band_lists','songs','proposals','comments','band_members') then
    v_band_id := coalesce(nullif(v_new->>'band_id','')::uuid, nullif(v_old->>'band_id','')::uuid);
  elsif TG_TABLE_NAME in ('band_list_items','band_list_managers') then
    v_band_id := (select l.band_id from public.band_lists l where l.id = coalesce(nullif(v_new->>'list_id','')::uuid, nullif(v_old->>'list_id','')::uuid));
  elsif TG_TABLE_NAME in ('materials','material_blocks','material_attachments') then
    if TG_TABLE_NAME = 'materials' then
      v_band_id := coalesce(nullif(v_new->>'band_id','')::uuid, nullif(v_old->>'band_id','')::uuid);
    else
      v_parent_material_id := coalesce(nullif(v_new->>'material_id','')::uuid, nullif(v_old->>'material_id','')::uuid);
      select m.band_id into v_band_id from public.materials m where m.id = v_parent_material_id;
    end if;
  else return coalesce(NEW, OLD); end if;
  if TG_OP <> 'INSERT' then v_old_deleted := nullif(v_old->>'deleted_at','')::timestamptz; end if;
  if TG_OP <> 'DELETE' then v_new_deleted := nullif(v_new->>'deleted_at','')::timestamptz; end if;
  if TG_OP = 'INSERT' then v_action := 'create';
  elsif TG_OP = 'DELETE' then v_action := 'delete';
  elsif v_old_deleted is null and v_new_deleted is not null then v_action := 'trash';
  elsif v_old_deleted is not null and v_new_deleted is null then v_action := 'restore';
  else v_action := 'update'; end if;
  if v_band_id is not null then
    insert into public.audit_log (band_id,actor_user_id,entity_type,entity_id,action,before_data,after_data)
    values (v_band_id,(select auth.uid()),v_entity_type,coalesce(nullif(v_new->>'id','')::uuid,nullif(v_old->>'id','')::uuid),v_action,v_old,v_new);
  end if;
  return coalesce(NEW, OLD);
end;
$$;
revoke all on function private.write_audit_log() from public, anon, authenticated;
drop trigger if exists audit_materials on public.materials;
create trigger audit_materials after insert or update or delete on public.materials for each row execute function private.write_audit_log();
drop trigger if exists audit_material_blocks on public.material_blocks;
create trigger audit_material_blocks after insert or update or delete on public.material_blocks for each row execute function private.write_audit_log();
drop trigger if exists audit_material_attachments on public.material_attachments;
create trigger audit_material_attachments after insert or update or delete on public.material_attachments for each row execute function private.write_audit_log();
