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
  active_status,
  color,
  duration,
  meter,
  original_bpm,
  original_key,
  original_duration,
  original_meter
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
    list_status,
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
      list_status,
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
    list_status,
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
      list_status,
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
