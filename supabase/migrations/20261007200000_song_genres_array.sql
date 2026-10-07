-- Store song genres as independent values instead of one comma-delimited text value.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'genre'
      and data_type = 'text'
  ) then
    execute $sql$
      alter table public.songs
        alter column genre type text[]
        using (
          case
            when genre is null or btrim(genre) = '' then null
            else regexp_split_to_array(genre, '\s*,\s*')
          end
        );
    $sql$;
  end if;
end
$$;
