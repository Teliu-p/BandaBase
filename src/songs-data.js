function normalizeSongGenres(value) {
  const raw = Array.isArray(value)
    ? value
    : (
        typeof value === "string"
          ? value.split(",")
          : []
      );

  const result = [];
  const seen = new Set();

  raw.forEach(item => {
    const genre = String(item || "").trim();

    if (!genre) {
      return;
    }

    const key = genre.toLocaleLowerCase("es");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(genre);
  });

  return result;
}


function formatSongGenres(value) {
  return normalizeSongGenres(value).join(", ");
}


const SONG_COLUMNS = `
  id,
  band_id,
  name,
  artist,
  genre,
  bpm,
  song_key,
  singer,
  list_status,
  status,
  active_status,
  in_repertoire,
  color,
  duration,
  meter,
  original_bpm,
  original_key,
  original_duration,
  original_meter,
  deleted_at,
  deleted_by
`;


async function getSongsByBand(
  supabaseClient,
  bandId
) {

  return await supabaseClient
    .from("songs")
    .select(SONG_COLUMNS)
    .eq(
      "band_id",
      bandId
    )
    .is("deleted_at", null)
    .order(
      "name",
      {
        ascending: true
      }
    );

}


async function getSongById(
  supabaseClient,
  songId
) {

  return await supabaseClient
    .from("songs")
    .select(SONG_COLUMNS)
    .eq(
      "id",
      songId
    )
    .is("deleted_at", null)
    .single();

}


async function createSong(
  supabaseClient,
  songData
) {

  const {
    band_id,
    name,
    artist,
    genre,
    bpm,
    duration,
    meter,
    color,
    status,
    active_status,
    singer,
    song_key
  } =
    songData;

  return await supabaseClient
    .from("songs")
    .insert({
      band_id,
      name,
      artist,
      genre,
      bpm,
      duration,
      meter,
      color,
      status,
      active_status,
      singer,
      song_key
    })
    .select()
    .single();

}


async function updateSong(
  supabaseClient,
  songId,
  songData
) {

  const {
    name,
    artist,
    genre,
    bpm,
    duration,
    meter,
    color,
    status,
    active_status,
    singer,
    song_key,
    original_bpm,
    original_key,
    original_duration,
    original_meter
  } =
    songData;

  return await supabaseClient
    .from("songs")
    .update({
      name,
      artist,
      genre,
      bpm,
      duration,
      meter,
      color,
      status,
      active_status,
      singer,
      song_key,
      original_bpm,
      original_key,
      original_duration,
      original_meter
    })
    .eq(
      "id",
      songId
    );

}


async function setSongRepertoireStatus(
  supabaseClient,
  songId,
  listStatus
) {
  return await supabaseClient
    .from("songs")
    .update({
      in_repertoire: Boolean(listStatus)
    })
    .eq("id", songId);
}


async function deleteSongs(
  supabaseClient,
  songIds,
  deletedBy = currentUser?.id || null
) {
  const ids = [
    ...new Set(
      (songIds || []).filter(Boolean)
    )
  ];

  if (!ids.length) {
    return { error: null };
  }

  return await supabaseClient
    .from("songs")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .in("id", ids);
}
