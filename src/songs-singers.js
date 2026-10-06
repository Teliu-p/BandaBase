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

  const {
    error: deleteError
  } =
    await supabaseClient
      .from("song_singers")
      .delete()
      .eq(
        "song_id",
        songId
      );

  if (deleteError) {
    return {
      error:
        deleteError,
      operation:
        "delete"
    };
  }

  if (!singers.length) {
    return {
      error: null,
      operation: null
    };
  }

  const {
    error: insertError
  } =
    await createSongSingers(
      supabaseClient,
      songId,
      singers
    );

  return {
    error:
      insertError,
    operation:
      insertError
        ? "insert"
        : null
  };

}
