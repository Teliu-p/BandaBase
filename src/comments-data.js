const COMMENT_COLUMNS = `
  id,
  band_id,
  song_id,
  user_id,
  content,
  created_at,
  deleted_at,
  deleted_by
`;

const COMMENT_ATTACHMENT_COLUMNS = `
  id,
  comment_id,
  band_id,
  kind,
  name,
  file_name,
  storage_path,
  url,
  mime_type,
  file_size,
  created_by,
  created_at
`;

const COMMENT_BLOCK_COLUMNS = `
  id,
  comment_id,
  block_type,
  content,
  attachment_id,
  position,
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
    .is("deleted_at", null)
    .order(
      "created_at",
      {
        ascending: true
      }
    );

}


async function getGeneralCommentsByBandId(
  supabaseClient,
  bandId,
  limit = 50
) {

  return await supabaseClient
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq(
      "band_id",
      bandId
    )
    .is("deleted_at", null)
    .is(
      "song_id",
      null
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(limit);

}


async function getCommentAttachmentsByCommentIds(
  supabaseClient,
  commentIds
) {

  if (!commentIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("comment_attachments")
    .select(COMMENT_ATTACHMENT_COLUMNS)
    .in(
      "comment_id",
      commentIds
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

}


async function getCommentBlocksByCommentIds(
  supabaseClient,
  commentIds
) {

  if (!commentIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("comment_blocks")
    .select(COMMENT_BLOCK_COLUMNS)
    .in(
      "comment_id",
      commentIds
    )
    .order(
      "position",
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
    song_id = null,
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


async function createCommentAttachment(
  supabaseClient,
  attachmentData
) {

  return await supabaseClient
    .from("comment_attachments")
    .insert(
      attachmentData
    )
    .select(
      COMMENT_ATTACHMENT_COLUMNS
    )
    .single();

}


async function replaceCommentBlocks(
  supabaseClient,
  commentId,
  blocks
) {
  return await supabaseClient.rpc(
    "replace_comment_blocks",
    {
      p_comment_id: commentId,
      p_blocks: (blocks || []).map(item => ({
        block_type: item.block_type,
        content: item.content ?? null,
        attachment_id: item.attachment_id ?? null,
        position: Number.isInteger(item.position)
          ? item.position
          : null
      }))
    }
  );
}


async function deleteCommentAttachment(
  supabaseClient,
  attachmentId
) {

  return await supabaseClient
    .from("comment_attachments")
    .delete()
    .eq(
      "id",
      attachmentId
    );

}


async function deleteComment(
  supabaseClient,
  commentId,
  deletedBy = currentUser?.id || null
) {
  return await supabaseClient
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .eq("id", commentId);
}

async function deleteComments(
  supabaseClient,
  commentIds
) {
  const ids = [
    ...new Set(
      (commentIds || []).filter(Boolean)
    )
  ];

  for (const commentId of ids) {
    const { error } =
      await deleteComment(
        supabaseClient,
        commentId
      );

    if (error) {
      return { error };
    }
  }

  return { error: null };
}
