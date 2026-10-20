async function getSongSingersBySongIds(
  supabaseClient,
  songIds
) {

  return await supabaseClient
    .from("song_singers")
    .select(
      "id, song_id, singer, song_key"
    )
    .in(
      "song_id",
      songIds
    );

}


function buildSongSingerRows(
  songId,
  singers
) {

  return singers.map(item => ({
    song_id:
      songId,

    singer:
      item.singer,

    song_key:
      item.song_key
  }));

}


async function createSongSingers(
  supabaseClient,
  songId,
  singers
) {

  return await supabaseClient
    .from("song_singers")
    .insert(
      buildSongSingerRows(
        songId,
        singers
      )
    );

}


async function replaceSongSingers(
  supabaseClient,
  songId,
  singers
) {
  return await supabaseClient.rpc(
    "replace_song_singers",
    {
      p_song_id: songId,
      p_singers: (singers || []).map(item => ({
        singer: item.singer,
        song_key: item.song_key ?? null
      }))
    }
  );
}


async function saveSongWithSingers(
  supabaseClient,
  songId,
  songData,
  singers
) {
  return await supabaseClient.rpc(
    "save_song_with_singers",
    {
      p_song_id: songId,
      p_song_data: songData,
      p_singers: (singers || []).map(item => ({
        singer: item.singer,
        song_key: item.song_key ?? null
      }))
    }
  );
}
