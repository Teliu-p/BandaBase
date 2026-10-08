function prepareCommentRows(
  comments,
  attachments,
  blocks
) {
  const attachmentsByComment = {};
  const attachmentsById = {};
  const blocksByComment = {};

  (attachments || []).forEach(
    attachment => {
      (
        attachmentsByComment[
          attachment.comment_id
        ] ||= []
      ).push(attachment);

      attachmentsById[
        attachment.id
      ] = attachment;
    }
  );

  (blocks || []).forEach(
    block => {
      (
        blocksByComment[
          block.comment_id
        ] ||= []
      ).push({
        ...block,
        attachment:
          block.attachment_id
            ? attachmentsById[
                block.attachment_id
              ] || null
            : null
      });
    }
  );

  return (comments || []).map(
    comment => {
      const commentAttachments =
        attachmentsByComment[
          comment.id
        ] || [];

      const dbBlocks =
        blocksByComment[
          comment.id
        ] || [];

      const orderedBlocks =
        dbBlocks.length
          ? dbBlocks.map(
              block =>
                block.block_type ===
                  "text"
                  ? {
                      block_type: "text",
                      content:
                        block.content || ""
                    }
                  : {
                      block_type:
                        "attachment",
                      attachment_id:
                        block.attachment_id,
                      attachment:
                        block.attachment
                    }
            )
          : [
              {
                block_type: "text",
                content:
                  comment.content || ""
              },
              ...commentAttachments.map(
                attachment => ({
                  block_type:
                    "attachment",
                  attachment_id:
                    attachment.id,
                  attachment
                })
              )
            ];

      return {
        ...comment,
        attachments:
          commentAttachments,
        blocks:
          orderedBlocks
      };
    }
  );
}


function formatCommentDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  ).format(date);
}


function getCommentAuthorNameFromMap(
  comment,
  map
) {
  if (
    comment.user_id ===
    currentUser?.id
  ) {
    const currentName =
      currentProfile?.full_name ||
      currentProfile?.display_name;

    if (currentName) {
      return currentName;
    }
  }

  const profile =
    map[comment.user_id];

  return (
    profile?.full_name ||
    profile?.display_name ||
    "Usuario"
  );
}


function renderCommentBlocks(
  blocks
) {
  return (blocks || [])
    .map(block => {
      if (
        block.block_type ===
        "text"
      ) {
        return (
          '<div class="comment-view-text">' +
          escapeHtml(
            block.content || ""
          ) +
          "</div>"
        );
      }

      const attachment =
        block.attachment;

      if (!attachment) return "";

      const name =
        getCommentAttachmentName(
          attachment
        );

      const icon =
        getCommentAttachmentIcon(
          attachment
        );

      if (
        attachment.kind ===
          "file" &&
        String(
          attachment.mime_type ||
          ""
        ).startsWith("audio/")
      ) {
        return (
          '<div class="comment-view-attachment">' +
          "<strong>" +
          icon +
          " " +
          escapeHtml(name) +
          "</strong>" +
          '<div class="comment-attachment-type">' +
          escapeHtml(
            attachment.mime_type ||
            "Audio"
          ) +
          "</div>" +
          '<audio class="comment-audio" controls preload="metadata" data-comment-audio="' +
          escapeHtml(
            attachment.storage_path ||
            ""
          ) +
          '"></audio>' +
          "</div>"
        );
      }

      return (
        '<div class="comment-view-attachment">' +
        '<div class="comment-attachment-row">' +
        '<div class="comment-attachment-main">' +
        "<strong>" +
        icon +
        " " +
        escapeHtml(name) +
        "</strong>" +
        '<div class="comment-attachment-type">' +
        escapeHtml(
          attachment.kind ===
            "link"
            ? "Enlace"
            : attachment.mime_type ||
              "Archivo"
        ) +
        (
          attachment.kind ===
            "link" &&
          attachment.url
            ? " · " +
              escapeHtml(
                attachment.url
              )
            : ""
        ) +
        "</div>" +
        "</div>" +
        '<button type="button" class="btn btn-subtle" data-open-comment-attachment="' +
        escapeHtml(
          attachment.id
        ) +
        '">Abrir</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}


function renderComments() {
  const list =
    document.getElementById(
      "commentsList"
    );

  if (!list) return;

  if (!currentComments.length) {
    list.innerHTML =
      '<div class="empty-state">Todavía no hay comentarios sobre esta canción.<br>Sé el primero en dejar uno.</div>';
    return;
  }

  list.innerHTML =
    currentComments
      .map(comment => {
        const canContextDelete =
          comment.user_id === currentUser?.id;

        let html =
          '<article class="comment-card"' +
          (
            canContextDelete
              ? ' data-context-delete="songComment" data-context-delete-id="' +
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
              commentProfilesMap
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
          canManageComment
        ) {
          html +=
            '<div class="comment-actions">' +
            '<button type="button" class="btn btn-subtle" data-edit-comment="' +
            escapeHtml(comment.id) +
            '">Editar</button>' +
            '<button type="button" class="btn btn-subtle btn-danger" data-delete-comment="' +
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
      })
      .join("");

  bindSongCommentEvents();
  bindCommentAttachmentEvents();
}


async function loadComments() {
  const list =
    document.getElementById(
      "commentsList"
    );

  if (
    !currentSong ||
    !list
  ) {
    return;
  }

  list.innerHTML =
    "Cargando...";

  try {
    const result =
      await getCommentsBySongId(
        supabaseClient,
        currentSong.id
      );

    if (result.error) {
      throw result.error;
    }

    currentComments =
      await fetchCommentData(
        result.data || []
      );

    commentProfilesMap =
      {};

    const userIds =
      Array.from(
        new Set(
          currentComments
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
          commentProfilesMap[
            profile.user_id
          ] = profile;
        }
      );
    }

    renderComments();
  } catch (error) {
    showNotice(
      error.message,
      "error"
    );
  }
}


function bindSongCommentEvents() {
  document
    .querySelectorAll(
      "[data-edit-comment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          function() {
            const comment =
              currentComments.find(
                item =>
                  item.id ===
                  button.dataset
                    .editComment
              );

            if (!comment) return;

            editingCommentId =
              comment.id;

            openCommentComposer(
              "song",
              comment.blocks,
              comment.attachments
            );

            document
              .getElementById(
                "saveCommentBtn"
              ).textContent =
              "Guardar cambios";

            document
              .getElementById(
                "cancelCommentBtn"
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
      "[data-delete-comment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async function() {
            const comment =
              currentComments.find(
                item =>
                  item.id ===
                  button.dataset
                    .deleteComment
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

            await loadComments();
          }
        );
      }
    );
}


function bindCommentAttachmentEvents() {
  document
    .querySelectorAll(
      "[data-open-comment-attachment]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async function() {
            const id =
              button.dataset
                .openCommentAttachment;

            const attachment =
              [
                ...generalComments,
                ...currentComments
              ]
                .flatMap(
                  comment =>
                    comment.attachments ||
                    []
                )
                .find(
                  item =>
                    item.id ===
                    id
                );

            if (!attachment) return;

            if (
              attachment.kind ===
              "link"
            ) {
              const url =
                getSafeCommentUrl(
                  attachment.url
                );

              if (!url) {
                showNotice(
                  "El enlace guardado no es válido.",
                  "error"
                );
                return;
              }

              window.open(
                url,
                "_blank",
                "noopener,noreferrer"
              );
              return;
            }

            if (!attachment.storage_path) {
              return;
            }

            const {
              data,
              error
            } =
              await supabaseClient
                .storage
                .from("materials")
                .createSignedUrl(
                  attachment.storage_path,
                  3600
                );

            if (
              error ||
              !data?.signedUrl
            ) {
              showNotice(
                error?.message ||
                  "No se pudo abrir el archivo.",
                "error"
              );
              return;
            }

            window.open(
              data.signedUrl,
              "_blank",
              "noopener,noreferrer"
            );
          }
        );
      }
    );

  void hydrateCommentAudioPlayers();
}


async function hydrateCommentAudioPlayers() {
  const players =
    document.querySelectorAll(
      "[data-comment-audio]"
    );

  for (
    const player of players
  ) {
    const path =
      player.dataset.commentAudio;

    if (!path) continue;

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from("materials")
        .createSignedUrl(
          path,
          3600
        );

    if (
      error ||
      !data?.signedUrl
    ) {
      continue;
    }

    player.src =
      data.signedUrl;
  }
}


function resetGeneralCommentForm() {
  document
    .getElementById(
      "showGeneralCommentFormBtn"
    )
    ?.classList.remove("hidden");

  document
    .getElementById(
      "generalCommentForm"
    )
    ?.classList.add("hidden");

  generalEditingCommentId =
    null;

  document
    .getElementById(
      "generalCommentForm"
    )
    ?.reset();

  resetCommentComposer(
    "general"
  );

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
}


function resetCommentForm() {
  editingCommentId =
    null;

  document
    .getElementById(
      "commentForm"
    )
    ?.reset();

  resetCommentComposer(
    "song"
  );

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
}


function bindCommentComposer(type) {
  const config =
    getCommentComposerConfig(type);

  const editor =
    document.getElementById(
      config.editorId
    );

  const fileInput =
    document.getElementById(
      config.fileInputId
    );

  const fileButton =
    document.getElementById(
      config.fileButtonId
    );

  const linkButton =
    document.getElementById(
      config.linkButtonId
    );

  if (
    !editor ||
    !fileInput ||
    !fileButton ||
    !linkButton
  ) {
    return;
  }

  [
    "mouseup",
    "keyup",
    "focus",
    "input"
  ].forEach(
    eventName =>
      editor.addEventListener(
        eventName,
        () =>
          rememberCommentSelection(
            type
          )
      )
  );

  editor.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key !== "Enter" &&
        event.key !== "Tab"
      ) {
        return;
      }

      event.preventDefault();

      const selection =
        window.getSelection();

      if (
        !selection ||
        !selection.rangeCount
      ) {
        return;
      }

      const range =
        selection.getRangeAt(0);

      if (
        !editor.contains(
          range.startContainer
        )
      ) {
        return;
      }

      range.deleteContents();

      const node =
        document.createTextNode(
          event.key === "Tab"
            ? "  "
            : "\n"
        );

      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

      rememberCommentSelection(
        type
      );
    }
  );

  editor.addEventListener(
    "paste",
    function(event) {
      event.preventDefault();

      const text =
        event.clipboardData?.getData(
          "text/plain"
        ) || "";

      const selection =
        window.getSelection();

      if (
        !selection ||
        !selection.rangeCount
      ) {
        return;
      }

      const range =
        selection.getRangeAt(0);

      range.deleteContents();

      const node =
        document.createTextNode(
          text
        );

      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

      rememberCommentSelection(
        type
      );
    }
  );

  fileButton.addEventListener(
    "mousedown",
    () =>
      rememberCommentSelection(type)
  );

  fileButton.addEventListener(
    "click",
    function() {
      rememberCommentSelection(type);
      fileInput.value = "";
      fileInput.click();
    }
  );

  fileInput.addEventListener(
    "change",
    function() {
      const file =
        fileInput.files?.[0];

      if (!file) return;

      const pendingKey =
        crypto.randomUUID();

      getCommentState(type)
        .pendingAttachments[
          pendingKey
        ] = {
          kind: "file",
          file,
          name: file.name
        };

      insertCommentNodeAtSelection(
        type,
        createCommentInlineAttachment(
          {
            kind: "file",
            name: file.name,
            mime_type:
              file.type
          },
          type,
          pendingKey
        )
      );
    }
  );

  linkButton.addEventListener(
    "mousedown",
    () =>
      rememberCommentSelection(type)
  );

  linkButton.addEventListener(
    "click",
    function() {
      rememberCommentSelection(type);

      const name =
        window.prompt(
          "Nombre del enlace"
        );

      if (name === null) return;

      const input =
        window.prompt(
          "Pegá la URL"
        );

      if (input === null) return;

      const url =
        getSafeCommentUrl(input);

      if (!url) {
        showNotice(
          "El enlace debe empezar con http:// o https://.",
          "error"
        );
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      getCommentState(type)
        .pendingAttachments[
          pendingKey
        ] = {
          kind: "link",
          name:
            name.trim() ||
            url,
          url
        };

      insertCommentNodeAtSelection(
        type,
        createCommentInlineAttachment(
          {
            kind: "link",
            name:
              name.trim() ||
              url
          },
          type,
          pendingKey
        )
      );
    }
  );
}


document
  .getElementById(
    "showGeneralCommentFormBtn"
  )
  ?.addEventListener(
    "click",
    function() {
      const form =
        document.getElementById(
          "generalCommentForm"
        );

      if (!form) return;

      form.classList.remove("hidden");

      document
        .getElementById(
          "showGeneralCommentFormBtn"
        )
        ?.classList.add("hidden");

      document
        .getElementById(
          "generalCommentComposerEditor"
        )
        ?.focus();
    }
  );

document
  .getElementById(
    "cancelGeneralCommentBtn"
  )
  ?.addEventListener(
    "click",
    resetGeneralCommentForm
  );

document
  .getElementById(
    "cancelCommentBtn"
  )
  ?.addEventListener(
    "click",
    resetCommentForm
  );

document
  .getElementById(
    "generalCommentForm"
  )
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      await saveCommentComposer(
        "general"
      );
    }
  );

document
  .getElementById(
    "commentForm"
  )
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      await saveCommentComposer(
        "song"
      );
    }
  );

bindCommentComposer(
  "general"
);
bindCommentComposer(
  "song"
);
bindCommentComposer(
  "comparison"
);
