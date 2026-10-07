const COMMENT_COLUMNS = `
  id,
  band_id,
  song_id,
  user_id,
  content,
  created_at
`;


async function getCommentsBySongId(
  supabaseClient,
  songId
) {

  return await supabaseClient
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq(
      "song_id",
      songId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

}


async function createComment(
  supabaseClient,
  commentData
) {

  const {
    band_id,
    song_id,
    user_id,
    content
  } =
    commentData;

  return await supabaseClient
    .from("comments")
    .insert({
      band_id,
      song_id,
      user_id,
      content
    })
    .select(COMMENT_COLUMNS)
    .single();

}


async function updateComment(
  supabaseClient,
  commentId,
  content
) {

  return await supabaseClient
    .from("comments")
    .update({
      content
    })
    .eq(
      "id",
      commentId
    );

}


async function deleteComment(
  supabaseClient,
  commentId
) {

  return await supabaseClient
    .from("comments")
    .delete()
    .eq(
      "id",
      commentId
    );

}
