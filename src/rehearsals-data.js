const REHEARSAL_COLUMNS = `
  id,
  band_id,
  title,
  rehearsal_date,
  rehearsal_time,
  mode,
  agenda,
  notes,
  created_by,
  created_at
`;


const REHEARSAL_SONG_COLUMNS = `
  id,
  rehearsal_id,
  song_id,
  position,
  notes,
  created_at
`;


async function getRehearsalsByBandId(
  supabaseClient,
  bandId
) {

  return await supabaseClient
    .from("rehearsals")
    .select(REHEARSAL_COLUMNS)
    .eq(
      "band_id",
      bandId
    )
    .order(
      "rehearsal_date",
      {
        ascending: false,
        nullsFirst: false
      }
    )
    .order(
      "rehearsal_time",
      {
        ascending: false,
        nullsFirst: false
      }
    );

}


async function createRehearsal(
  supabaseClient,
  rehearsalData
) {

  return await supabaseClient
    .from("rehearsals")
    .insert(
      rehearsalData
    )
    .select(REHEARSAL_COLUMNS)
    .single();

}


async function updateRehearsal(
  supabaseClient,
  rehearsalId,
  rehearsalData
) {

  return await supabaseClient
    .from("rehearsals")
    .update(
      rehearsalData
    )
    .eq(
      "id",
      rehearsalId
    )
    .select(REHEARSAL_COLUMNS)
    .single();

}


async function deleteRehearsal(
  supabaseClient,
  rehearsalId
) {

  return await supabaseClient
    .from("rehearsals")
    .delete()
    .eq(
      "id",
      rehearsalId
    );

}


async function getRehearsalSongsByRehearsalIds(
  supabaseClient,
  rehearsalIds
) {

  if (!rehearsalIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("rehearsal_songs")
    .select(
      REHEARSAL_SONG_COLUMNS
    )
    .in(
      "rehearsal_id",
      rehearsalIds
    )
    .order(
      "position",
      {
        ascending: true
      }
    );

}


async function replaceRehearsalSongs(
  supabaseClient,
  rehearsalId,
  songIds
) {
  return await supabaseClient.rpc(
    "replace_rehearsal_songs",
    {
      p_rehearsal_id: rehearsalId,
      p_song_ids: (songIds || []).filter(Boolean)
    }
  );
}

