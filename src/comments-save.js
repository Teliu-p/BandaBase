/* Persistencia de Comentarios. */

async function saveCommentComposer(type) {
  if (
    !currentBand ||
    !currentUser ||
    (type === "song" && !currentSong)
  ) {
    return;
  }

  const state =
    getCommentState(type);

  const blocks =
    collectCommentComposerBlocks(
      type
    );

  const text =
    getCommentText(blocks);

  const hasAttachment =
    blocks.some(
      block =>
        block.block_type ===
        "attachment"
    );

  if (
    !text &&
    !hasAttachment
  ) {
    showNotice(
      "El comentario no puede estar vacío.",
      "error"
    );
    return;
  }

  if (text.length > 5000) {
    showNotice(
      "El texto del comentario no puede superar los 5000 caracteres.",
      "error"
    );
    return;
  }

  const isGeneral =
    type === "general";

  const editingId =
    isGeneral
      ? generalEditingCommentId
      : editingCommentId;

  let commentId =
    editingId;

  if (editingId) {
    const { error } =
      await updateComment(
        supabaseClient,
        editingId,
        text
      );

    if (error) {
      showNotice(
        error.message,
        "error"
      );
      return;
    }
  } else {
    const {
      data: comment,
      error
    } = await createComment(
      supabaseClient,
      {
        band_id:
          currentBand.id,
        song_id:
          isGeneral
            ? null
            : currentSong.id,
        user_id:
          currentUser.id,
        content:
          text
      }
    );

    if (error) {
      showNotice(
        error.message,
        "error"
      );
      return;
    }

    commentId =
      comment.id;
  }

  const persistedBlocks = [];
  const newlyCreated = [];

  try {
    for (const block of blocks) {
      if (
        block.block_type ===
        "text"
      ) {
        persistedBlocks.push({
          block_type:
            "text",
          content:
            block.content || ""
        });
        continue;
      }

      if (block.attachment_id) {
        persistedBlocks.push({
          block_type:
            "attachment",
          content:
            null,
          attachment_id:
            block.attachment_id
        });
        continue;
      }

      const pending =
        state.pendingAttachments[
          block.pendingKey
        ];

      if (!pending) continue;

      if (
        pending.kind ===
        "link"
      ) {
        const {
          data: attachment,
          error
        } =
          await createCommentAttachment(
            supabaseClient,
            {
              comment_id:
                commentId,
              band_id:
                currentBand.id,
              kind:
                "link",
              name:
                pending.name,
              file_name:
                null,
              storage_path:
                null,
              url:
                pending.url,
              mime_type:
                null,
              file_size:
                null,
              created_by:
                currentUser.id
            }
          );

        if (error) throw error;

        newlyCreated.push(
          attachment
        );

        persistedBlocks.push({
          block_type:
            "attachment",
          content:
            null,
          attachment_id:
            attachment.id
        });

        continue;
      }

      const file =
        pending.file;

      if (!file) continue;

      const storagePath =
        currentBand.id +
        "/comments/" +
        commentId +
        "/" +
        crypto.randomUUID() +
        "-" +
        sanitizeStorageFileName(
          file.name
        );

      const {
        error: uploadError
      } =
        await supabaseClient
          .storage
          .from("materials")
          .upload(
            storagePath,
            file,
            {
              upsert: false,
              contentType:
                file.type ||
                undefined
            }
          );

      if (uploadError) {
        throw new Error(
          "No se pudo subir " +
          file.name +
          ": " +
          uploadError.message
        );
      }

      const {
        data: attachment,
        error
      } =
        await createCommentAttachment(
          supabaseClient,
          {
            comment_id:
              commentId,
            band_id:
              currentBand.id,
            kind:
              "file",
            name:
              file.name,
            file_name:
              file.name,
            storage_path:
              storagePath,
            url:
              null,
            mime_type:
              file.type ||
              null,
            file_size:
              file.size ||
              null,
            created_by:
              currentUser.id
          }
        );

      if (error) {
        await supabaseClient
          .storage
          .from("materials")
          .remove([
            storagePath
          ]);
        throw error;
      }

      newlyCreated.push(
        attachment
      );

      persistedBlocks.push({
        block_type:
          "attachment",
        content:
          null,
        attachment_id:
          attachment.id
      });
    }

    const {
      error: blocksError
    } =
      await replaceCommentBlocks(
        supabaseClient,
        commentId,
        persistedBlocks.map(
          (block, index) => ({
            comment_id:
              commentId,
            block_type:
              block.block_type,
            content:
              block.content,
            attachment_id:
              block.attachment_id ||
              null,
            position:
              index
          })
        )
      );

    if (blocksError) {
      throw blocksError;
    }

    const keptIds =
      new Set(
        persistedBlocks
          .filter(
            block =>
              block.block_type ===
                "attachment" &&
              block.attachment_id
          )
          .map(
            block =>
              block.attachment_id
          )
      );

    const removedIds =
      [...state.originalAttachmentIds]
        .filter(
          id =>
            !keptIds.has(id)
        );

    if (removedIds.length) {
      const source =
        isGeneral
          ? generalComments
          : currentComments;

      const originalComment =
        source.find(
          comment =>
            comment.id ===
            commentId
        );

      const removedAttachments =
        (
          originalComment?.attachments ||
          []
        ).filter(
          attachment =>
            removedIds.includes(
              attachment.id
            )
        );

      const storagePaths =
        removedAttachments
          .filter(
            attachment =>
              attachment.kind ===
                "file" &&
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
          showNotice(
            "El comentario se guardó, pero algunos archivos quitados no pudieron borrarse.",
            "error"
          );
        }
      }

      for (
        const attachmentId of
        removedIds
      ) {
        await deleteCommentAttachment(
          supabaseClient,
          attachmentId
        );
      }
    }

  } catch (error) {
    if (!editingId) {
      await deleteComment(
        supabaseClient,
        commentId
      );
    } else if (
      newlyCreated.length
    ) {
      const filePaths =
        newlyCreated
          .filter(
            attachment =>
              attachment.kind ===
                "file" &&
              attachment.storage_path
          )
          .map(
            attachment =>
              attachment.storage_path
          );

      if (filePaths.length) {
        await supabaseClient
          .storage
          .from("materials")
          .remove(
            filePaths
          );
      }

      for (
        const attachment of
        newlyCreated
      ) {
        await deleteCommentAttachment(
          supabaseClient,
          attachment.id
        );
      }
    }

    showNotice(
      error.message ||
        "No se pudo guardar el contenido del comentario.",
      "error"
    );

    return;
  }

  if (isGeneral) {
    generalEditingCommentId =
      null;

    resetCommentComposer(
      "general"
    );

    document
      .getElementById(
        "generalCommentForm"
      )
      ?.reset();

    document
      .getElementById(
        "cancelGeneralCommentBtn"
      )
      ?.classList.add(
        "hidden"
      );

    document
      .getElementById(
        "saveGeneralCommentBtn"
      ).textContent =
      "Publicar comentario";

    showNotice(
      editingId
        ? "Comentario actualizado."
        : "Comentario publicado.",
      "success"
    );

    await loadGeneralComments();
    await loadRecentGeneralComments();

  } else {
    editingCommentId =
      null;

    resetCommentComposer(
      "song"
    );

    document
      .getElementById(
        "commentForm"
      )
      ?.reset();

    document
      .getElementById(
        "cancelCommentBtn"
      )
      ?.classList.add(
        "hidden"
      );

    document
      .getElementById(
        "saveCommentBtn"
      ).textContent =
      "Publicar comentario";

    showNotice(
      editingId
        ? "Comentario actualizado."
        : "Comentario publicado.",
      "success"
    );

    await loadComments();
  }
}
