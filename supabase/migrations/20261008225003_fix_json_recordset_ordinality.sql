-- Fix WITH ORDINALITY usage in JSON record replacement RPCs.
-- Keep authorization checks and transactional delete/insert behavior unchanged.
create or replace function public.replace_material_blocks(
  p_material_id uuid,
  p_blocks jsonb
)
returns setof public.material_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then
    raise exception 'No hay un usuario autenticado';
  end if;
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'Los bloques deben ser un arreglo';
  end if;
  if not exists (
    select 1 from public.materials m
    where m.id = p_material_id
      and (m.created_by = auth.uid() or public.is_band_admin(m.band_id))
  ) then
    if not exists (select 1 from public.materials m where m.id = p_material_id) then
      raise exception 'El material no existe';
    end if;
    raise exception 'No tenés permiso para editar este material';
  end if;

  delete from public.material_blocks where material_id = p_material_id;

  insert into public.material_blocks(material_id, block_type, content, attachment_id, position)
  select p_material_id, x.block_type, x.content, x.attachment_id,
         coalesce(x.position, e.ordinality::integer - 1)
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as e(value, ordinality)
  cross join lateral jsonb_to_record(e.value) as x(
    block_type text, content text, attachment_id uuid, position integer
  );

  return query
    select b.* from public.material_blocks b
    where b.material_id = p_material_id order by b.position, b.id;
end;
$function$;

create or replace function public.replace_comment_blocks(
  p_comment_id uuid,
  p_blocks jsonb
)
returns setof public.comment_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then
    raise exception 'No hay un usuario autenticado';
  end if;
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'Los bloques deben ser un arreglo';
  end if;
  if not exists (
    select 1 from public.comments c
    where c.id = p_comment_id and c.deleted_at is null
      and (c.user_id = auth.uid() or public.is_band_admin(c.band_id))
  ) then
    raise exception 'No tenés permiso para editar este comentario';
  end if;

  delete from public.comment_blocks where comment_id = p_comment_id;

  insert into public.comment_blocks(comment_id, block_type, content, attachment_id, position)
  select p_comment_id, x.block_type, x.content, x.attachment_id,
         coalesce(x.position, e.ordinality::integer - 1)
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as e(value, ordinality)
  cross join lateral jsonb_to_record(e.value) as x(
    block_type text, content text, attachment_id uuid, position integer
  );

  return query
    select b.* from public.comment_blocks b
    where b.comment_id = p_comment_id order by b.position, b.id;
end;
$function$;

create or replace function public.replace_proposal_blocks(
  p_proposal_id uuid,
  p_blocks jsonb
)
returns setof public.proposal_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then
    raise exception 'No hay un usuario autenticado';
  end if;
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'Los bloques deben ser un arreglo';
  end if;
  if not exists (
    select 1 from public.proposals p
    where p.id = p_proposal_id and p.deleted_at is null
      and (p.created_by = auth.uid() or public.is_band_admin(p.band_id))
  ) then
    raise exception 'No tenés permiso para editar esta propuesta';
  end if;

  delete from public.proposal_blocks where proposal_id = p_proposal_id;

  insert into public.proposal_blocks(proposal_id, block_type, content, attachment_id, position)
  select p_proposal_id, x.block_type, x.content, x.attachment_id,
         coalesce(x.position, e.ordinality::integer - 1)
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) with ordinality as e(value, ordinality)
  cross join lateral jsonb_to_record(e.value) as x(
    block_type text, content text, attachment_id uuid, position integer
  );

  return query
    select b.* from public.proposal_blocks b
    where b.proposal_id = p_proposal_id order by b.position, b.id;
end;
$function$;

create or replace function public.replace_band_list_items(
  p_list_id uuid,
  p_items jsonb
)
returns setof public.band_list_items
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare
  v_band_id uuid;
  v_created_by uuid;
begin
  if auth.uid() is null then
    raise exception 'No hay un usuario autenticado';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Los ítems deben ser un arreglo';
  end if;

  select l.band_id, l.created_by into v_band_id, v_created_by
  from public.band_lists l where l.id = p_list_id and l.deleted_at is null;

  if not found then
    raise exception 'La lista no existe o fue eliminada';
  end if;
  if v_created_by <> auth.uid() and not public.is_band_admin(v_band_id) then
    raise exception 'Solo el creador o un administrador puede reemplazar los ítems de la lista';
  end if;

  perform set_config('bandabase.skip_list_auto_confirm', 'on', true);

  delete from public.band_list_items where list_id = p_list_id;

  insert into public.band_list_items(
    list_id, item_type, title, details, song_id, member_user_id, status,
    position, participation_instruments, created_by
  )
  select p_list_id, x.item_type, x.title, x.details, x.song_id, x.member_user_id,
         x.status, coalesce(x.position, e.ordinality::integer - 1),
         coalesce(x.participation_instruments, '{}'::text[]), auth.uid()
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as e(value, ordinality)
  cross join lateral jsonb_to_record(e.value) as x(
    item_type text, title text, details text, song_id uuid, member_user_id uuid,
    status text, position integer, participation_instruments text[]
  );

  perform set_config('bandabase.skip_list_auto_confirm', 'off', true);
  perform public.auto_confirm_band_list_members(p_list_id);

  return query
    select i.* from public.band_list_items i
    where i.list_id = p_list_id order by i.position, i.id;
end;
$function$;

-- Preserve the intended authenticated-only RPC access.
grant execute on function public.replace_material_blocks(uuid, jsonb) to authenticated;
revoke execute on function public.replace_material_blocks(uuid, jsonb) from public, anon;
grant execute on function public.replace_comment_blocks(uuid, jsonb) to authenticated;
revoke execute on function public.replace_comment_blocks(uuid, jsonb) from public, anon;
grant execute on function public.replace_proposal_blocks(uuid, jsonb) to authenticated;
revoke execute on function public.replace_proposal_blocks(uuid, jsonb) from public, anon;
grant execute on function public.replace_band_list_items(uuid, jsonb) to authenticated;
revoke execute on function public.replace_band_list_items(uuid, jsonb) from public, anon;
