-- BandaBase: permisos de administracion, recuperacion y endurecimiento
-- Applied to production as: 20261008000928_admin_restore_hardening

create or replace function public.restore_band_change(p_audit_id uuid)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_log public.audit_log%rowtype;
  v_current jsonb;
  v_assignments text;
begin
  select *
    into v_log
  from public.audit_log
  where id = p_audit_id;

  if not found then
    raise exception 'No se encontró ese cambio.';
  end if;

  if v_log.action not in ('update','trash') then
    raise exception 'Ese cambio no puede restaurarse directamente.';
  end if;

  if not is_band_admin(v_log.band_id) then
    raise exception 'No tenés permiso para restaurar cambios.';
  end if;

  if v_log.entity_type not in ('songs','band_lists','proposals','comments') then
    raise exception 'Ese tipo de cambio no admite restauración directa.';
  end if;

  execute format(
    'select to_jsonb(t) from public.%I t where t.id = $1',
    v_log.entity_type
  )
  into v_current
  using v_log.entity_id;

  if v_current is null then
    raise exception 'El registro ya no existe.';
  end if;

  if v_current is distinct from v_log.after_data then
    raise exception 'Ese registro cambió nuevamente y el estado elegido ya no es el actual.';
  end if;

  select string_agg(
    format('%I = r.%I', column_name, column_name),
    ', ' order by ordinal_position
  )
  into v_assignments
  from information_schema.columns
  where table_schema = 'public'
    and table_name = v_log.entity_type
    and column_name <> 'id'
    and is_generated = 'NEVER';

  if v_assignments is null then
    raise exception 'No se pudo reconstruir el registro.';
  end if;

  execute format(
    'update public.%I as t
        set %s
       from jsonb_populate_record(null::public.%I, $1) as r
      where t.id = $2',
    v_log.entity_type,
    v_assignments,
    v_log.entity_type
  )
  using v_log.before_data, v_log.entity_id;

  return jsonb_build_object(
    'restored', true,
    'entity_type', v_log.entity_type,
    'entity_id', v_log.entity_id
  );
end;
$$;

revoke all on function public.restore_band_change(uuid) from anon;
grant execute on function public.restore_band_change(uuid) to authenticated;

drop policy if exists songs_delete_admin on public.songs;
drop policy if exists band_lists_delete_admin on public.band_lists;
drop policy if exists proposals_delete_admin on public.proposals;
drop policy if exists comments_delete_admin on public.comments;

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.band_id is distinct from new.band_id
     or old.user_id is distinct from new.user_id then
    raise exception 'No se puede mover ni reasignar un integrante.';
  end if;

  return new;
end;
$$;

drop trigger if exists band_members_identity_guard on public.band_members;
create trigger band_members_identity_guard
before update on public.band_members
for each row
execute function private.prevent_membership_identity_change();

revoke all on function public.create_band(text) from anon, authenticated;
revoke all on function public.enter_bandabase() from anon, authenticated;
