/* Contenido y editor de Propuestas. */

function getProposalAttachments(proposalId) {
  return proposalAttachmentsMap[proposalId] || [];
}


function getProposalBlocks(proposalId) {
  return proposalBlocksMap[proposalId] || [];
}


function formatProposalFileSize(size) {
  const bytes = Number(size);

  if (!Number.isFinite(bytes) || bytes < 1) {
    return "";
  }

  if (bytes < 1024) {
    return bytes + " B";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}


function normalizeProposalLink(value) {
  try {
    const url = new URL(String(value || "").trim());

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.href;
  } catch (error) {
    return null;
  }
}


function sanitizeProposalFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "archivo";
}


function getProposalAttachmentIcon(attachment) {
  if (attachment?.kind === "link") {
    return "🔗";
  }

  if (
    String(attachment?.mime_type || "")
      .startsWith("audio/")
  ) {
    return "🎧";
  }

  if (
    String(attachment?.mime_type || "")
      .includes("pdf")
  ) {
    return "📄";
  }

  return "📎";
}


function rememberProposalSelection() {
  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(0);

  if (
    editor.contains(range.startContainer) &&
    editor.contains(range.endContainer)
  ) {
    proposalSelectionRange =
      range.cloneRange();
  }
}


function restoreProposalSelection() {
  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  if (
    !editor ||
    !proposalSelectionRange
  ) {
    return false;
  }

  const selection =
    window.getSelection();

  try {
    selection.removeAllRanges();
    selection.addRange(proposalSelectionRange);
    return true;
  } catch (error) {
    return false;
  }
}


function createProposalInlineAttachment(
  attachment,
  pendingKey = null
) {
  const wrapper =
    document.createElement(
      "span"
    );

  wrapper.className =
    "proposal-inline-attachment";

  wrapper.contentEditable =
    "false";

  if (attachment?.id) {
    wrapper.dataset.attachmentId =
      attachment.id;
  }

  if (pendingKey) {
    wrapper.dataset.pendingKey =
      pendingKey;
  }

  wrapper.appendChild(
    document.createTextNode(
      getProposalAttachmentIcon(
        attachment
      ) +
      " " +
      (
        attachment?.name ||
        attachment?.file_name ||
        attachment?.title ||
        "Archivo"
      ) +
      " "
    )
  );

  const removeButton =
    document.createElement(
      "button"
    );

  removeButton.type =
    "button";

  removeButton.className =
    "inline-remove";

  removeButton.textContent =
    "×";

  removeButton.title =
    "Quitar";

  removeButton.addEventListener(
    "mousedown",
    function(event) {
      event.preventDefault();
    }
  );

  removeButton.addEventListener(
    "click",
    function(event) {
      event.preventDefault();
      wrapper.remove();
    }
  );

  wrapper.appendChild(
    removeButton
  );

  return wrapper;
}


function insertProposalNodeAtSelection(node) {
  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  if (!editor) {
    return;
  }

  editor.focus();

  const hasSelection =
    restoreProposalSelection();

  let range =
    proposalSelectionRange;

  if (!hasSelection) {
    range =
      document.createRange();

    range.selectNodeContents(
      editor
    );

    range.collapse(false);
  }

  range.deleteContents();

  const spacerBefore =
    document.createTextNode(" ");

  const spacerAfter =
    document.createTextNode(" ");

  range.insertNode(spacerAfter);
  range.insertNode(node);
  range.insertNode(spacerBefore);

  range.setStartAfter(
    spacerAfter
  );

  range.collapse(true);

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(range);

  proposalSelectionRange =
    range.cloneRange();
}


function collectProposalComposerBlocks() {
  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  if (!editor) {
    return [];
  }

  const blocks = [];
  let textBuffer = "";

  const flushText =
    function() {
      if (
        textBuffer.length ||
        !blocks.length
      ) {
        blocks.push({
          block_type:
            "text",
          content:
            textBuffer
        });
      }

      textBuffer =
        "";
    };

  editor.childNodes.forEach(
    node => {
      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {
        textBuffer +=
          node.textContent || "";
        return;
      }

      if (
        node.nodeType !==
        Node.ELEMENT_NODE
      ) {
        return;
      }

      const element =
        node;

      if (
        element.classList.contains(
          "proposal-inline-attachment"
        )
      ) {
        flushText();

        blocks.push({
          block_type:
            "attachment",
          attachment_id:
            element.dataset.attachmentId ||
            null,
          pendingKey:
            element.dataset.pendingKey ||
            null
        });

        return;
      }

      textBuffer +=
        element.innerText ||
        "";
    }
  );

  if (
    textBuffer.length ||
    !blocks.length
  ) {
    blocks.push({
      block_type:
        "text",
      content:
        textBuffer
    });
  }

  return blocks;
}


function collectProposalLegacyText(blocks) {
  return blocks
    .filter(
      block =>
        block.block_type ===
        "text"
    )
    .map(
      block =>
        block.content || ""
    )
    .join("\n\n")
    .trim();
}


function renderProposalContent(proposal) {
  const blocks =
    getProposalBlocks(
      proposal.id
    );

  if (!blocks.length) {
    return "";
  }

  let html = "";

  blocks.forEach(
    block => {
      if (
        block.block_type ===
        "text"
      ) {
        html +=
          '<div class="proposal-detail">' +
          escapeHtml(
            block.content || ""
          ) +
          "</div>";
        return;
      }

      const attachment =
        block.attachment;

      if (!attachment) {
        return;
      }

      const icon =
        getProposalAttachmentIcon(
          attachment
        );

      if (
        attachment.kind ===
        "link"
      ) {
        const href =
          normalizeProposalLink(
            attachment.url
          );

        if (!href) {
          return;
        }

        html +=
          '<div class="proposal-inline-content">' +
          '<a class="proposal-inline-resource" href="' +
          escapeHtml(href) +
          '" target="_blank" rel="noopener noreferrer">' +
          icon +
          " " +
          escapeHtml(
            attachment.title ||
            attachment.url ||
            "Enlace"
          ) +
          " ↗</a>" +
          "</div>";

        return;
      }

      html +=
        '<div class="proposal-inline-content">';

      if (attachment.signed_url) {
        html +=
          '<a class="proposal-inline-resource" href="' +
          escapeHtml(
            attachment.signed_url
          ) +
          '" target="_blank" rel="noopener noreferrer">' +
          icon +
          " " +
          escapeHtml(
            attachment.file_name ||
            attachment.title ||
            "Archivo"
          ) +
          (
            formatProposalFileSize(
              attachment.file_size
            )
              ? " · " +
                escapeHtml(
                  formatProposalFileSize(
                    attachment.file_size
                  )
                )
              : ""
          ) +
          " ↗</a>";
      } else {
        html +=
          icon +
          " " +
          escapeHtml(
            attachment.file_name ||
            attachment.title ||
            "Archivo"
          );
      }

      html +=
        "</div>";
    }
  );

  return html
    ? '<div class="proposal-content">' +
      html +
      "</div>"
    : "";
}


async function saveProposalComposerContent(
  proposal,
  composedBlocks
) {
  const persistedBlocks = [];
  const errors = [];

  for (
    const block
    of composedBlocks
  ) {
    if (
      block.block_type ===
      "text"
    ) {
      persistedBlocks.push({
        proposal_id:
          proposal.id,
        block_type:
          "text",
        content:
          block.content || "",
        attachment_id:
          null
      });
      continue;
    }

    if (
      block.block_type !==
      "attachment"
    ) {
      continue;
    }

    if (
      block.attachment_id
    ) {
      persistedBlocks.push({
        proposal_id:
          proposal.id,
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
      proposalPendingAttachments[
        block.pendingKey
      ];

    if (!pending) {
      continue;
    }

    let attachment = null;

    if (
      pending.kind ===
      "link"
    ) {
      const result =
        await createProposalAttachment(
          supabaseClient,
          {
            proposal_id:
              proposal.id,
            band_id:
              currentBand.id,
            kind:
              "link",
            title:
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

      if (result.error) {
        errors.push(
          "No se pudo guardar el enlace: " +
          result.error.message
        );
        continue;
      }

      attachment =
        result.data;

    } else {
      const file =
        pending.file;

      if (!file) {
        continue;
      }

      const storagePath =
        currentBand.id +
        "/proposals/" +
        proposal.id +
        "/" +
        crypto.randomUUID() +
        "_" +
        sanitizeProposalFileName(
          file.name
        );

      const uploadResult =
        await supabaseClient
          .storage
          .from("materials")
          .upload(
            storagePath,
            file,
            {
              cacheControl:
                "3600",
              upsert:
                false,
              contentType:
                file.type ||
                undefined
            }
          );

      if (uploadResult.error) {
        errors.push(
          "No se pudo subir " +
          file.name +
          ": " +
          uploadResult.error.message
        );
        continue;
      }

      const result =
        await createProposalAttachment(
          supabaseClient,
          {
            proposal_id:
              proposal.id,
            band_id:
              currentBand.id,
            kind:
              "file",
            title:
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
              file.size,
            created_by:
              currentUser.id
          }
        );

      if (result.error) {
        await supabaseClient
          .storage
          .from("materials")
          .remove([
            storagePath
          ]);

        errors.push(
          "No se pudo registrar " +
          file.name +
          ": " +
          result.error.message
        );
        continue;
      }

      attachment =
        result.data;
    }

    persistedBlocks.push({
      proposal_id:
        proposal.id,
      block_type:
        "attachment",
      content:
        null,
      attachment_id:
        attachment.id
    });
  }

  const { error: blocksError } =
    await replaceProposalBlocks(
      supabaseClient,
      proposal.id,
      persistedBlocks.map(
        (item, index) => ({
          ...item,
          position:
            index
        })
      )
    );

  if (blocksError) {
    errors.push(
      "No se pudo guardar el orden del contenido: " +
      blocksError.message
    );
  }

  return errors;
}


function resetProposalComposer() {
  proposalSelectionRange =
    null;

  proposalPendingAttachments =
    {};

  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  if (editor) {
    editor.innerHTML =
      "";
  }

  const fileInput =
    document.getElementById(
      "proposalPendingFile"
    );

  if (fileInput) {
    fileInput.value =
      "";
  }
}


function openProposalComposer() {
  resetProposalComposer();

  const editor =
    document.getElementById(
      "proposalComposerEditor"
    );

  if (editor) {
    editor.appendChild(
      document.createTextNode("")
    );
  }
}
