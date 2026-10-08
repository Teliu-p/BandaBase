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

  select l.band_id, l.created_by
    into v_band_id, v_created_by
  from public.band_lists l
  where l.id = p_list_id
    and l.deleted_at is null;

  if not found then
    raise exception 'La lista no existe o fue eliminada';
  end if;

  if v_created_by <> auth.uid()
     and not public.is_band_admin(v_band_id) then
    raise exception 'Solo el creador o un administrador puede reemplazar los ítems de la lista';
  end if;

  delete from public.band_list_items
  where list_id = p_list_id;

  insert into public.band_list_items (
    list_id,
    item_type,
    title,
    details,
    song_id,
    member_user_id,
    status,
    position,
    participation_instruments,
    created_by
  )
  select
    p_list_id,
    x.item_type,
    x.title,
    x.details,
    x.song_id,
    x.member_user_id,
    x.status,
    coalesce(x.position, row_number() over (order by x.ordinality) - 1),
    coalesce(x.participation_instruments, '{}'::text[]),
    auth.uid()
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    with ordinality as x(
      item_type text,
      title text,
      details text,
      song_id uuid,
      member_user_id uuid,
      status text,
      position integer,
      participation_instruments text[],
      ordinality bigint
    );

  return query
    select i.*
    from public.band_list_items i
    where i.list_id = p_list_id
    order by i.position, i.id;
end;
$function$;

grant execute on function public.replace_band_list_items(uuid, jsonb) to authenticated;
revoke execute on function public.replace_band_list_items(uuid, jsonb) from anon, public;