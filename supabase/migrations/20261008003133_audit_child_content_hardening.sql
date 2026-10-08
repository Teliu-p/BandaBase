CREATE OR REPLACE FUNCTION private.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
declare
  v_old jsonb;
  v_new jsonb;
  v_band_id uuid;
  v_old_deleted timestamptz;
  v_new_deleted timestamptz;
  v_action text;
  v_entity_type text;
  v_parent_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
  else
    v_old := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
    v_new := to_jsonb(NEW);
  end if;

  -- Proposal options are intentionally omitted from the audit stream because
  -- proposal-level edits already provide the canonical proposal history.
  if TG_TABLE_NAME = 'proposal_options' then
    return coalesce(NEW, OLD);
  end if;

  v_entity_type := TG_TABLE_NAME;

  -- Only member participation items are relevant to the band history.
  if TG_TABLE_NAME = 'band_list_items'
     and coalesce(v_new->>'item_type', v_old->>'item_type') <> 'member' then
    return coalesce(NEW, OLD);
  end if;

  if TG_TABLE_NAME in ('band_lists','songs','proposals','comments','band_members','materials') then
    v_band_id := coalesce(
      nullif(v_new->>'band_id','')::uuid,
      nullif(v_old->>'band_id','')::uuid
    );
  elsif TG_TABLE_NAME in ('band_list_items','band_list_managers') then
    v_parent_id := coalesce(
      nullif(v_new->>'list_id','')::uuid,
      nullif(v_old->>'list_id','')::uuid
    );
    select l.band_id into v_band_id
    from public.band_lists l
    where l.id = v_parent_id;
  elsif TG_TABLE_NAME in ('proposal_blocks','proposal_attachments') then
    v_parent_id := coalesce(
      nullif(v_new->>'proposal_id','')::uuid,
      nullif(v_old->>'proposal_id','')::uuid
    );
    select p.band_id into v_band_id
    from public.proposals p
    where p.id = v_parent_id;
  elsif TG_TABLE_NAME in ('comment_blocks','comment_attachments') then
    v_parent_id := coalesce(
      nullif(v_new->>'comment_id','')::uuid,
      nullif(v_old->>'comment_id','')::uuid
    );
    select c.band_id into v_band_id
    from public.comments c
    where c.id = v_parent_id;
  elsif TG_TABLE_NAME in ('material_blocks','material_attachments') then
    v_parent_id := coalesce(
      nullif(v_new->>'material_id','')::uuid,
      nullif(v_old->>'material_id','')::uuid
    );
    select m.band_id into v_band_id
    from public.materials m
    where m.id = v_parent_id;
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
$function$;

REVOKE ALL ON FUNCTION private.write_audit_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_proposal_blocks ON public.proposal_blocks;
CREATE TRIGGER audit_proposal_blocks
AFTER INSERT OR DELETE OR UPDATE ON public.proposal_blocks
FOR EACH ROW EXECUTE FUNCTION private.write_audit_log();

DROP TRIGGER IF EXISTS audit_proposal_attachments ON public.proposal_attachments;
CREATE TRIGGER audit_proposal_attachments
AFTER INSERT OR DELETE OR UPDATE ON public.proposal_attachments
FOR EACH ROW EXECUTE FUNCTION private.write_audit_log();

DROP TRIGGER IF EXISTS audit_comment_blocks ON public.comment_blocks;
CREATE TRIGGER audit_comment_blocks
AFTER INSERT OR DELETE OR UPDATE ON public.comment_blocks
FOR EACH ROW EXECUTE FUNCTION private.write_audit_log();

DROP TRIGGER IF EXISTS audit_comment_attachments ON public.comment_attachments;
CREATE TRIGGER audit_comment_attachments
AFTER INSERT OR DELETE OR UPDATE ON public.comment_attachments
FOR EACH ROW EXECUTE FUNCTION private.write_audit_log();
