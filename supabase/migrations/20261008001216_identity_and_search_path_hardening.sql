-- BandaBase: impedir cambios de identidad/propiedad y fijar search_path
create or replace function private.prevent_content_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.band_id is distinct from new.band_id then
    raise exception 'No se puede mover un registro entre bandas.';
  end if;

  if tg_table_name <> 'comments'
     and old.created_by is distinct from new.created_by then
    raise exception 'No se puede cambiar el creador de un registro.';
  end if;

  if tg_table_name = 'comments'
     and old.user_id is distinct from new.user_id then
    raise exception 'No se puede cambiar el autor de un comentario.';
  end if;

  return new;
end;
$$;

drop trigger if exists songs_content_identity_guard on public.songs;
create trigger songs_content_identity_guard
before update on public.songs
for each row
execute function private.prevent_content_identity_change();

drop trigger if exists band_lists_content_identity_guard on public.band_lists;
create trigger band_lists_content_identity_guard
before update on public.band_lists
for each row
execute function private.prevent_content_identity_change();

drop trigger if exists proposals_content_identity_guard on public.proposals;
create trigger proposals_content_identity_guard
before update on public.proposals
for each row
execute function private.prevent_content_identity_change();

drop trigger if exists comments_content_identity_guard on public.comments;
create trigger comments_content_identity_guard
before update on public.comments
for each row
execute function private.prevent_content_identity_change();

alter function public.set_updated_at()
set search_path = public, pg_catalog;
