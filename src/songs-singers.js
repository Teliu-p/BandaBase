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
