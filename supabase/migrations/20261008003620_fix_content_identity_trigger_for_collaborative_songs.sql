CREATE OR REPLACE FUNCTION private.prevent_content_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
declare
  v_old_band_id uuid;
  v_new_band_id uuid;
  v_old_creator_id uuid;
  v_new_creator_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  v_old_band_id := nullif(to_jsonb(OLD)->>'band_id', '')::uuid;
  v_new_band_id := nullif(to_jsonb(NEW)->>'band_id', '')::uuid;

  if v_old_band_id is distinct from v_new_band_id then
    raise exception 'No se puede mover un registro entre bandas.';
  end if;

  if TG_TABLE_NAME <> 'comments' then
    v_old_creator_id := nullif(to_jsonb(OLD)->>'created_by', '')::uuid;
    v_new_creator_id := nullif(to_jsonb(NEW)->>'created_by', '')::uuid;

    if v_old_creator_id is distinct from v_new_creator_id then
      raise exception 'No se puede cambiar el creador de un registro.';
    end if;
  else
    v_old_user_id := nullif(to_jsonb(OLD)->>'user_id', '')::uuid;
    v_new_user_id := nullif(to_jsonb(NEW)->>'user_id', '')::uuid;

    if v_old_user_id is distinct from v_new_user_id then
      raise exception 'No se puede cambiar el autor de un comentario.';
    end if;
  end if;

  return NEW;
end;
$function$;

REVOKE ALL ON FUNCTION private.prevent_content_identity_change() FROM PUBLIC, anon, authenticated;
