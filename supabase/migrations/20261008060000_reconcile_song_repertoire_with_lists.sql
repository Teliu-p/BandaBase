create schema if not exists private;

create or replace function private.sync_song_repertoire_for_song(
  p_song_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_song_id is null then
    return;
  end if;

  update public.songs as s
  set in_repertoire = exists (
    select 1
    from public.band_list_items as li
    join public.band_lists as l
      on l.id = li.list_id
    where li.item_type = 'song'
      and li.song_id = p_song_id
      and l.deleted_at is null
  )
  where s.id = p_song_id;
end;
$function$;

create or replace function private.trg_sync_song_repertoire_from_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT'
     and old.song_id is not null then
    perform private.sync_song_repertoire_for_song(old.song_id);
  end if;

  if tg_op <> 'DELETE'
     and new.song_id is not null
     and (
       tg_op = 'INSERT'
       or old.song_id is distinct from new.song_id
     ) then
    perform private.sync_song_repertoire_for_song(new.song_id);
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function private.trg_sync_song_repertoire_from_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.songs as s
  set in_repertoire = exists (
    select 1
    from public.band_list_items as li
    join public.band_lists as l
      on l.id = li.list_id
    where li.item_type = 'song'
      and li.song_id = s.id
      and l.deleted_at is null
  )
  where s.id in (
    select li.song_id
    from public.band_list_items as li
    where li.list_id = new.id
      and li.item_type = 'song'
      and li.song_id is not null
  );

  return new;
end;
$function$;

revoke all on function private.sync_song_repertoire_for_song(uuid)
  from public, anon, authenticated;

revoke all on function private.trg_sync_song_repertoire_from_item()
  from public, anon, authenticated;

revoke all on function private.trg_sync_song_repertoire_from_list()
  from public, anon, authenticated;

drop trigger if exists band_list_items_sync_song_repertoire
  on public.band_list_items;

create trigger band_list_items_sync_song_repertoire
after insert or update of list_id, song_id or delete
on public.band_list_items
for each row
execute function private.trg_sync_song_repertoire_from_item();

drop trigger if exists band_lists_sync_song_repertoire
  on public.band_lists;

create trigger band_lists_sync_song_repertoire
after update of deleted_at
on public.band_lists
for each row
execute function private.trg_sync_song_repertoire_from_list();

update public.songs as s
set in_repertoire = exists (
  select 1
  from public.band_list_items as li
  join public.band_lists as l
    on l.id = li.list_id
  where li.item_type = 'song'
    and li.song_id = s.id
    and l.deleted_at is null
)
where s.deleted_at is null;
