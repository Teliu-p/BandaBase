create or replace function public.replace_material_blocks(
  p_material_id uuid,
  p_blocks jsonb
)
returns setof public.material_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare v_band_id uuid;
begin
  if auth.uid() is null then raise exception 'No hay un usuario autenticado'; end if;
  if jsonb_typeof(coalesce(p_blocks,'[]'::jsonb)) <> 'array' then raise exception 'Los bloques deben ser un arreglo'; end if;

  select m.band_id into v_band_id from public.materials m where m.id=p_material_id;
  if not found then raise exception 'El material no existe'; end if;

  if not exists (
    select 1 from public.materials m
    where m.id=p_material_id
      and (m.created_by=auth.uid() or public.is_band_admin(m.band_id))
  ) then
    raise exception 'No tenés permiso para editar este material';
  end if;

  delete from public.material_blocks where material_id=p_material_id;

  insert into public.material_blocks(material_id,block_type,content,attachment_id,position)
  select p_material_id,x.block_type,x.content,x.attachment_id,
         coalesce(x.position,row_number() over(order by x.ordinality)-1)
  from jsonb_to_recordset(coalesce(p_blocks,'[]'::jsonb)) with ordinality as x(
    block_type text,content text,attachment_id uuid,position integer,ordinality bigint
  );

  return query
    select b.* from public.material_blocks b
    where b.material_id=p_material_id order by b.position,b.id;
end;
$function$;

grant execute on function public.replace_material_blocks(uuid,jsonb) to authenticated;
revoke execute on function public.replace_material_blocks(uuid,jsonb) from public,anon;