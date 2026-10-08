create or replace function public.replace_song_singers(
  p_song_id uuid,
  p_singers jsonb
)
returns setof public.song_singers
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then
    raise exception 'No hay un usuario autenticado';
  end if;

  if jsonb_typeof(coalesce(p_singers, '[]'::jsonb)) <> 'array' then
    raise exception 'Los cantantes deben ser un arreglo';
  end if;

  if not exists (
    select 1
    from public.songs s
    where s.id = p_song_id
      and s.deleted_at is null
      and public.is_band_member(s.band_id)
  ) then
    raise exception 'La canción no existe o no pertenece a tu banda';
  end if;

  delete from public.song_singers
  where song_id = p_song_id;

  insert into public.song_singers (
    song_id,
    singer,
    song_key
  )
  select
    p_song_id,
    x.singer,
    x.song_key
  from jsonb_to_recordset(coalesce(p_singers, '[]'::jsonb)) as x(
    singer text,
    song_key text
  )
  where nullif(trim(x.singer), '') is not null;

  return query
    select ss.*
    from public.song_singers ss
    where ss.song_id = p_song_id
    order by ss.id;
end;
$function$;

grant execute on function public.replace_song_singers(uuid, jsonb) to authenticated;
revoke execute on function public.replace_song_singers(uuid, jsonb) from anon, public;