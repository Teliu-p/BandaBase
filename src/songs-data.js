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
  songIds
) {
  const ids = [
    ...new Set(
      (songIds || []).filter(Boolean)
    )
  ];

  if (!ids.length) {
    return {
      error: null
    };
  }

  const [
    materialsResult,
    commentsResult
  ] = await Promise.all([
    supabaseClient
      .from("materials")
      .select("id")
      .in("song_id", ids),
    supabaseClient
      .from("comments")
      .select("id")
      .in("song_id", ids)
  ]);

  if (materialsResult.error) {
    return {
      error:
        materialsResult.error
    };
  }

  if (commentsResult.error) {
    return {
      error:
        commentsResult.error
    };
  }

  const materialIds =
    (materialsResult.data || [])
      .map(
        material =>
          material.id
      );

  const commentIds =
    (commentsResult.data || [])
      .map(
        comment =>
          comment.id
      );

  const [
    materialAttachmentsResult,
    commentAttachmentsResult
  ] = await Promise.all([
    materialIds.length
      ? supabaseClient
          .from("material_attachments")
          .select("id, storage_path, kind")
          .in(
            "material_id",
            materialIds
          )
      : {
          data: [],
          error: null
        },
    commentIds.length
      ? supabaseClient
          .from("comment_attachments")
          .select("id, storage_path, kind")
          .in(
            "comment_id",
            commentIds
          )
      : {
          data: [],
          error: null
        }
  ]);

  if (materialAttachmentsResult.error) {
    return {
      error:
        materialAttachmentsResult.error
    };
  }

  if (commentAttachmentsResult.error) {
    return {
      error:
        commentAttachmentsResult.error
    };
  }

  const storagePaths = [
    ...(materialAttachmentsResult.data || []),
    ...(commentAttachmentsResult.data || [])
  ]
    .filter(
      attachment =>
        attachment.kind === "file" &&
        attachment.storage_path
    )
    .map(
      attachment =>
        attachment.storage_path
    );

  if (storagePaths.length) {
    const {
      error: storageError
    } =
      await supabaseClient
        .storage
        .from("materials")
        .remove(
          storagePaths
        );

    if (storageError) {
      return {
        error:
          storageError
      };
    }
  }

  return await supabaseClient
    .from("songs")
    .delete()
    .in("id", ids);
}
