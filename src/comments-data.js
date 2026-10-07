const COMMENT_COLUMNS = `
  id,
  band_id,
  user_id,
  content,
  created_at
`;


async function getCommentsByBandId(
  supabaseClient,
  bandId
) {

  return await supabaseClient
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq(
      "band_id",
      bandId
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );

}


async function createComment(
  supabaseClient,
  commentData
) {

  const {
    band_id,
    user_id,
    content
  } =
    commentData;

  return await supabaseClient
    .from("comments")
    .insert({
      band_id,
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
