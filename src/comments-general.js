/* Comentarios generales. */

function renderGeneralCommentCard(
  comment,
  showActions = true
) {
  const canManageComment =
    comment.user_id === currentUser?.id ||
    window.bandabaseIsAdmin?.();

  const canContextDelete =
    canManageComment;

  let html =
    '<article class="comment-card"' +
    (
      canContextDelete
        ? ' data-context-delete="generalComment" data-context-delete-id="' +
          escapeHtml(comment.id) +
          '"'
        : ""
    ) +
    '>';

  html +=
    '<div class="comment-header">' +
    "<div>" +
    '<div class="comment-author">' +
    escapeHtml(
      getCommentAuthorNameFromMap(
        comment,
        generalCommentProfilesMap
      )
    ) +
    "</div>" +
    '<div class="comment-date">' +
    escapeHtml(
      formatCommentDate(
        comment.created_at
      )
    ) +
    "</div>" +
    "</div>";

  if (
    showActions &&
    canManageComment
  ) {
    html +=
      '<div class="comment-actions">' +
      '<button type="button" class="btn btn-subtle" data-edit-general-comment="' +
      escapeHtml(comment.id) +
      '">Editar</button>' +
      '<button type="button" class="btn btn-subtle btn-danger" data-delete-general-comment="' +
      escapeHtml(comment.id) +
      '">Eliminar</button>' +
      "</div>";
  }

  html +=
    "</div>" +
    '<div class="comment-content">' +
    renderCommentBlocks(
      comment.blocks
    ) +
    "</div>" +
    "</article>";

  return html;
}


function renderRecentGeneralComments() {
  const list =
    document.getElementById(
      "recentCommentsList"
    );

  if (!list) return;

  if (!generalComments.length) {
    list.innerHTML =
      '<div class="empty-state">Todavía no hay comentarios generales.</div>';
    return;
  }

  list.innerHTML =
    generalComments
      .map(
        comment =>
          renderGeneralCommentCard(
            comment,
            false
          )
      )
      .join("");

  bindCommentAttachmentEvents();
}


async function fetchCommentData(
  comments
) {
  const ids =
    (comments || []).map(
      comment =>
        comment.id
    );

  const [
    attachmentsResult,
    blocksResult
  ] = await Promise.all([
    getCommentAttachmentsByCommentIds(
      supabaseClient,
      ids
    ),
    getCommentBlocksByCommentIds(
      supabaseClient,
      ids
    )
  ]);

  if (attachmentsResult.error) {
    throw attachmentsResult.error;
  }

  if (blocksResult.error) {
    throw blocksResult.error;
  }

  return prepareCommentRows(
    comments || [],
    attachmentsResult.data || [],
    blocksResult.data || []
  );
}


async function loadGeneralComments() {
  if (!currentBand) return;

  const list =
    document.getElementById(
      "generalCommentsList"
    );

  if (!list) return;

  list.innerHTML = "Cargando...";

  try {
    const result =
      await getGeneralCommentsByBandId(
        supabaseClient,
        currentBand.id
      );

    if (result.error) {
      throw result.error;
    }

    generalComments =
      await fetchCommentData(
        result.data || []
      );

    generalCommentProfilesMap =
      {};

    const userIds =
      Array.from(
        new Set(
          generalComments
            .map(
              comment =>
                comment.user_id
            )
            .filter(Boolean)
        )
      );

    if (userIds.length) {
      const {
        data: profiles,
        error
      } = await supabaseClient
        .from("profiles")
        .select(
          "user_id, display_name, full_name"
        )
        .in(
          "user_id",
          userIds
        );

      if (error) throw error;

      (profiles || []).forEach(
        profile => {
          generalCommentProfilesMap[
            profile.user_id
          ] = profile;
        }
      );
    }

    renderGeneralComments();
  } catch (error) {
    showNotice(
      error.message,
      "error"
    );
  }
}


async function loadRecentGeneralComments() {
  if (!currentBand) return;

  try {
    const result =
      await getGeneralCommentsByBandId(
        supabaseClient,
        currentBand.id,
        5
      );

    if (result.error) {
      throw result.error;
    }

    generalComments =
      await fetchCommentData(
        result.data || []
      );

    generalCommentProfilesMap =
      {};

    const userIds =
      Array.from(
        new Set(
          generalComments
            .map(
              comment =>
                comment.user_id
            )
            .filter(Boolean)
        )
      );

    if (userIds.length) {
      const {
        data: profiles,
        error
      } = await supabaseClient
        .from("profiles")
        .select(
          "user_id, display_name, full_name"
        )
        .in(
          "user_id",
          userIds
        );

      if (error) throw error;

      (profiles || []).forEach(
        profile => {
          generalCommentProfilesMap[
            profile.user_id
          ] = profile;
        }
      );
    }

    renderRecentGeneralComments();
  } catch (error) {
    showNotice(
      error.message,
      "error"
    );
  }
}


function renderGeneralComments() {
  const list =
    document.getElementById(
      "generalCommentsList"
    );

  if (!list) return;

  if (!generalComments.length) {
    list.innerHTML =
      '<div class="empty-state">Todavía no hay comentarios generales.</div>';
    return;
  }

  list.innerHTML =
    generalComments
      .map(
        comment =>
          renderGeneralCommentCard(
            comment,
            true
          )
      )
      .join("");

  bindGeneralCommentEvents();
  bindCommentAttachmentEvents();
}

function bindGeneralCommentEvents() {
  document
    .querySelectorAll(
      "[data-edit-general-comment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          function() {
            const comment =
              generalComments.find(
                item =>
                  item.id ===
                  button.dataset
                    .editGeneralComment
              );

            if (!comment) return;

            generalEditingCommentId =
              comment.id;

            document
              .getElementById(
                "generalCommentForm"
              )
              ?.classList.remove("hidden");

            document
              .getElementById(
                "showGeneralCommentFormBtn"
              )
              ?.classList.add("hidden");

            openCommentComposer(
              "general",
              comment.blocks,
              comment.attachments
            );

            document
              .getElementById(
                "saveGeneralCommentBtn"
              ).textContent =
              "Guardar cambios";

            document
              .getElementById(
                "cancelGeneralCommentBtn"
              )
              .classList.remove(
                "hidden"
              );
          }
        );
      }
    );

  document
    .querySelectorAll(
      "[data-delete-general-comment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async function() {
            const comment =
              generalComments.find(
                item =>
                  item.id ===
                  button.dataset
                    .deleteGeneralComment
              );

            if (!comment) return;

            const confirmed =
              window.confirm(
                "¿Eliminar este comentario?"
              );

            if (!confirmed) return;

            const { error } =
              await deleteComment(
                supabaseClient,
                comment.id
              );

            if (error) {
              showNotice(
                error.message,
                "error"
              );
              return;
            }

            showNotice(
              "Comentario eliminado.",
              "success"
            );

            await loadGeneralComments();
            await loadRecentGeneralComments();
          }
        );
      }
    );
}
