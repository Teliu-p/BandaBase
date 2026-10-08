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

  perform set_config('bandabase.skip_list_auto_confirm','on',true);

  delete from public.band_list_items
  where list_id = p_list_id;

  insert into public.band_list_items (
    list_id,item_type,title,details,song_id,member_user_id,status,
    position,participation_instruments,created_by
  )
  select
    p_list_id,x.item_type,x.title,x.details,x.song_id,x.member_user_id,x.status,
    coalesce(x.position,row_number() over(order by x.ordinality)-1),
    coalesce(x.participation_instruments,'{}'::text[]),auth.uid()
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) with ordinality as x(
    item_type text,title text,details text,song_id uuid,member_user_id uuid,
    status text,position integer,participation_instruments text[],ordinality bigint
  );

  perform set_config('bandabase.skip_list_auto_confirm','off',true);
  perform public.auto_confirm_band_list_members(p_list_id);

  return query
    select i.* from public.band_list_items i
    where i.list_id=p_list_id order by i.position,i.id;
end;
$function$;

create or replace function public.trg_auto_confirm_band_list_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if current_setting('bandabase.skip_list_auto_confirm',true)='on' then
    return coalesce(new,old);
  end if;

  perform public.auto_confirm_band_list_members(coalesce(new.list_id,old.list_id));
  return coalesce(new,old);
end;
$function$;

create or replace function public.replace_comment_blocks(
  p_comment_id uuid,p_blocks jsonb
)
returns setof public.comment_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'No hay un usuario autenticado'; end if;
  if jsonb_typeof(coalesce(p_blocks,'[]'::jsonb)) <> 'array' then raise exception 'Los bloques deben ser un arreglo'; end if;

  if not exists (
    select 1 from public.comments c
    where c.id=p_comment_id and c.deleted_at is null
      and (c.user_id=auth.uid() or public.is_band_admin(c.band_id))
  ) then
    raise exception 'No tenés permiso para editar este comentario';
  end if;

  delete from public.comment_blocks where comment_id=p_comment_id;

  insert into public.comment_blocks(comment_id,block_type,content,attachment_id,position)
  select p_comment_id,x.block_type,x.content,x.attachment_id,
         coalesce(x.position,row_number() over(order by x.ordinality)-1)
  from jsonb_to_recordset(coalesce(p_blocks,'[]'::jsonb)) with ordinality as x(
    block_type text,content text,attachment_id uuid,position integer,ordinality bigint
  );

  return query
    select b.* from public.comment_blocks b
    where b.comment_id=p_comment_id order by b.position,b.id;
end;
$function$;

create or replace function public.replace_proposal_blocks(
  p_proposal_id uuid,p_blocks jsonb
)
returns setof public.proposal_blocks
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'No hay un usuario autenticado'; end if;
  if jsonb_typeof(coalesce(p_blocks,'[]'::jsonb)) <> 'array' then raise exception 'Los bloques deben ser un arreglo'; end if;

  if not exists (
    select 1 from public.proposals p
    where p.id=p_proposal_id and p.deleted_at is null
      and (p.created_by=auth.uid() or public.is_band_admin(p.band_id))
  ) then
    raise exception 'No tenés permiso para editar esta propuesta';
  end if;

  delete from public.proposal_blocks where proposal_id=p_proposal_id;

  insert into public.proposal_blocks(proposal_id,block_type,content,attachment_id,position)
  select p_proposal_id,x.block_type,x.content,x.attachment_id,
         coalesce(x.position,row_number() over(order by x.ordinality)-1)
  from jsonb_to_recordset(coalesce(p_blocks,'[]'::jsonb)) with ordinality as x(
    block_type text,content text,attachment_id uuid,position integer,ordinality bigint
  );

  return query
    select b.* from public.proposal_blocks b
    where b.proposal_id=p_proposal_id order by b.position,b.id;
end;
$function$;

create or replace function public.replace_rehearsal_songs(
  p_rehearsal_id uuid,p_song_ids uuid[]
)
returns setof public.rehearsal_songs
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare v_band_id uuid;
begin
  if auth.uid() is null then raise exception 'No hay un usuario autenticado'; end if;

  select r.band_id into v_band_id
  from public.rehearsals r where r.id=p_rehearsal_id;

  if not found or not public.is_band_member(v_band_id) then
    raise exception 'El ensayo no existe o no pertenece a tu banda';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_song_ids,'{}'::uuid[])) selected(song_id)
    where not exists (
      select 1 from public.songs s
      where s.id=selected.song_id and s.band_id=v_band_id and s.deleted_at is null
    )
  ) then
    raise exception 'Una o más canciones no pertenecen a la banda';
  end if;

  delete from public.rehearsal_songs where rehearsal_id=p_rehearsal_id;

  insert into public.rehearsal_songs(rehearsal_id,song_id,position)
  select p_rehearsal_id,selected.song_id,selected.position
  from unnest(coalesce(p_song_ids,'{}'::uuid[])) with ordinality selected(song_id,position);

  return query
    select rs.* from public.rehearsal_songs rs
    where rs.rehearsal_id=p_rehearsal_id order by rs.position,rs.id;
end;
$function$;

grant execute on function public.replace_band_list_items(uuid,jsonb) to authenticated;
grant execute on function public.replace_comment_blocks(uuid,jsonb) to authenticated;
grant execute on function public.replace_proposal_blocks(uuid,jsonb) to authenticated;
grant execute on function public.replace_rehearsal_songs(uuid,uuid[]) to authenticated;

revoke execute on function public.replace_band_list_items(uuid,jsonb) from public,anon;
revoke execute on function public.replace_comment_blocks(uuid,jsonb) from public,anon;
revoke execute on function public.replace_proposal_blocks(uuid,jsonb) from public,anon;
revoke execute on function public.replace_rehearsal_songs(uuid,uuid[]) from public,anon;