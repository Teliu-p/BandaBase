-- Store song genres as independent values instead of one comma-delimited text value.

alter table public.songs
  alter column genre type text[]
  using (
    case
      when genre is null or btrim(genre) = '' then null
      else regexp_split_to_array(genre, '\\s*,\\s*')
    end
  );
