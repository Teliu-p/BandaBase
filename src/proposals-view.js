let currentProposals = [];
let proposalOptionsMap = {};
let proposalVotesMap = {};
let proposalVoteStatsMap = {};
let proposalProfilesMap = {};
let proposalAttachmentsMap = {};
let proposalBlocksMap = {};
let proposalSelectionRange = null;
let proposalPendingAttachments = {};


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




function proposalTypeLabel(type) {
  if (type === "yes_no") {
    return "Sí / No";
  }

  if (type === "multiple") {
    return "Varias opciones";
  }

  return "Una opción";
}

function proposalVisibilityLabel(visibility) {
  return visibility === "anonymous"
    ? "Votos anónimos"
    : "Votos públicos";
}

function getProposalVoterName(userId) {
  if (userId === currentUser?.id) {
    return (
      currentProfile?.full_name ||
      currentProfile?.display_name ||
      "Vos"
    );
  }

  const profile =
    proposalProfilesMap[userId];

  return (
    profile?.full_name ||
    profile?.display_name ||
    "Integrante"
  );
}

function getProposalAuthorName(proposal) {
  if (proposal.created_by === currentUser?.id) {
    return (
      currentProfile?.full_name ||
      currentProfile?.display_name ||
      "Vos"
    );
  }

  const profile =
    proposalProfilesMap[proposal.created_by];

  return (
    profile?.full_name ||
    profile?.display_name ||
    "Integrante"
  );
}

function getProposalOptionLabelsFromForm() {
  return [...document.querySelectorAll(".proposal-option-input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function renderProposalOptionInputs(labels = ["", ""]) {
  const container = document.getElementById(
    "proposalOptionsInputs"
  );

  if (!container) {
    return;
  }

  container.innerHTML = labels
    .map(
      (label, index) =>
        `
        <div class="proposal-option-input-row">
          <input
            type="text"
            class="proposal-option-input"
            value="${escapeHtml(label || "")}"
            placeholder="Opción ${index + 1}"
            maxlength="120"
          >
          <button
            type="button"
            class="btn btn-subtle btn-danger proposal-remove-option"
            aria-label="Quitar opción"
          >
            ×
          </button>
        </div>
        `
    )
    .join("");

  container
    .querySelectorAll(".proposal-remove-option")
    .forEach(button => {
      button.addEventListener("click", () => {
        button
          .closest(".proposal-option-input-row")
          ?.remove();
        normalizeProposalOptionInputs();
      });
    });
}

function normalizeProposalOptionInputs() {
  document
    .querySelectorAll(".proposal-option-input")
    .forEach((input, index) => {
      input.placeholder = `Opción ${index + 1}`;
    });
}

function updateProposalTypeUI() {
  const type =
    document.getElementById("proposalVotingType")?.value;

  const addButton =
    document.getElementById("addProposalOptionBtn");

  const help =
    document.getElementById("proposalOptionsHelp");

  if (type === "yes_no") {
    renderProposalOptionInputs(["Sí", "No"]);
    addButton?.classList.add("hidden");

    if (help) {
      help.textContent =
        "La propuesta se votará por Sí o No.";
    }

    return;
  }

  addButton?.classList.remove("hidden");

  if (help) {
    help.textContent =
      type === "multiple"
        ? "Cada integrante puede elegir varias opciones."
        : "Cada integrante puede elegir una sola opción.";
  }

  const inputs = document.querySelectorAll(
    ".proposal-option-input"
  );

  if (!inputs.length) {
    renderProposalOptionInputs(["", ""]);
  }
}

function resetProposalForm() {
  const form =
    document.getElementById("proposalForm");

  form?.reset();

  const type =
    document.getElementById("proposalVotingType");

  if (type) {
    type.value = "single";
  }

  document
    .getElementById("proposalForm")
    ?.classList.add("hidden");

  renderProposalOptionInputs(["", ""]);
  resetProposalComposer();
  openProposalComposer();
  updateProposalTypeUI();
}

function openProposalForm() {
  const form =
    document.getElementById("proposalForm");

  if (!form) {
    return;
  }

  form.classList.toggle("hidden");

  if (!form.classList.contains("hidden")) {
    document
      .getElementById("proposalTitle")
      ?.focus();
  }
}

function getProposalVotes(proposalId) {
  return proposalVotesMap[proposalId] || [];
}

function getProposalOptionVotes(proposalId, optionId) {
  return getProposalVotes(proposalId).filter(
    vote => vote.option_id === optionId
  );
}

function getProposalVoteStats(proposalId) {
  return (
    proposalVoteStatsMap[proposalId] || {
      totalVoters: 0,
      byOption: {}
    }
  );
}

function getMyProposalOptionIds(proposalId) {
  return getProposalVotes(proposalId)
    .filter(
      vote =>
        vote.user_id === currentUser?.id &&
        vote.option_id
    )
    .map(vote => vote.option_id);
}

function renderProposalVoteControl(proposal) {
  const options =
    proposalOptionsMap[proposal.id] || [];

  const myVotes = new Set(
    getMyProposalOptionIds(proposal.id)
  );

  const disabled =
    proposal.status !== "Abierta";

  const inputType =
    proposal.voting_type === "multiple"
      ? "checkbox"
      : "radio";

  return options
    .map(
      option =>
        `
        <label class="proposal-vote-option ${
          myVotes.has(option.id)
            ? "selected"
            : ""
        }">
          <input
            type="${inputType}"
            name="proposal-${escapeHtml(proposal.id)}"
            value="${escapeHtml(option.id)}"
            ${
              myVotes.has(option.id)
                ? "checked"
                : ""
            }
            ${
              disabled
                ? "disabled"
                : ""
            }
          >
          <span>${escapeHtml(option.label)}</span>
        </label>
        `
    )
    .join("");
}

function renderProposalResults(proposal) {
  const options =
    proposalOptionsMap[proposal.id] || [];

  const votes =
    getProposalVotes(proposal.id);

  const stats =
    getProposalVoteStats(
      proposal.id
    );

  const totalVoters =
    Number(stats.totalVoters || 0);

  return `
    <div class="proposal-results">

      <div class="proposal-meta">
        ${totalVoters} integrante${totalVoters === 1 ? "" : "s"} votaron
      </div>

      ${
        options.length
          ? options
              .map(option => {
                const count =
                  Number(
                    stats.byOption?.[
                      option.id
                    ] || 0
                  );

                const percent =
                  totalVoters
                    ? Math.round(
                        (count * 100) /
                          totalVoters
                      )
                    : 0;

                let votersHtml = "";

                if (
                  proposal.voting_visibility !==
                    "anonymous" &&
                  votes.length
                ) {
                  const optionVotes =
                    getProposalOptionVotes(
                      proposal.id,
                      option.id
                    );

                  if (optionVotes.length) {
                    const names =
                      Array.from(
                        new Set(
                          optionVotes.map(
                            vote =>
                              getProposalVoterName(
                                vote.user_id
                              )
                          )
                        )
                      );

                    votersHtml =
                      '<div class="proposal-voter-list">' +
                      "Votan: " +
                      escapeHtml(
                        names.join(", ")
                      ) +
                      "</div>";
                  }
                }

                return `
                  <div class="proposal-result-row">
                    <div class="proposal-result-label">
                      <span>${escapeHtml(option.label)}</span>
                      <span>${count} (${percent}%)</span>
                    </div>

                    <div class="proposal-result-bar">
                      <span style="width:${percent}%"></span>
                    </div>

                    ${votersHtml}
                  </div>
                `;
              })
              .join("")
          : '<div class="empty-state">No hay opciones.</div>'
      }

      <div class="proposal-vote-count">
        ${
          proposal.voting_visibility === "anonymous"
            ? "Los nombres de los votantes no se muestran."
            : "Los votos son públicos."
        }
      </div>

    </div>
  `;
}

function renderProposalCard(proposal) {
  const options =
    proposalOptionsMap[proposal.id] || [];

  const open =
    proposal.status === "Abierta";

  const inputType =
    proposal.voting_type === "multiple"
      ? "checkbox"
      : "radio";

  const myVotes =
    new Set(getMyProposalOptionIds(proposal.id));

  const optionsHtml = options
    .map(
      option =>
        `
        <label class="proposal-vote-option ${
          myVotes.has(option.id)
            ? "selected"
            : ""
        }">
          <input
            type="${inputType}"
            name="proposal-${escapeHtml(proposal.id)}"
            value="${escapeHtml(option.id)}"
            ${
              myVotes.has(option.id)
                ? "checked"
                : ""
            }
            ${open ? "" : "disabled"}
          >
          <span>${escapeHtml(option.label)}</span>
        </label>
        `
    )
    .join("");

  const canManageProposal =
    proposal.created_by === currentUser?.id ||
    window.bandabaseIsAdmin?.();

  const actions =
    canManageProposal
      ? `
        <div class="proposal-card-actions">
          <button
            type="button"
            class="btn btn-subtle proposal-toggle-status"
          >
            ${open ? "Cerrar votación" : "Reabrir votación"}
          </button>
          <button
            type="button"
            class="btn btn-subtle btn-danger proposal-delete"
          >
            Eliminar
          </button>
        </div>
      `
      : "";

  return `
    <article
      class="proposal-card"
      data-proposal-id="${escapeHtml(proposal.id)}"
      ${canManageProposal ? `data-context-delete="proposal" data-context-delete-id="${escapeHtml(proposal.id)}"` : ""}
    >

      <div class="proposal-card-header">

        <div>

          <h3>${escapeHtml(proposal.title)}</h3>

          <div class="proposal-meta">
            ${escapeHtml(getProposalAuthorName(proposal))}
            ·
            ${escapeHtml(
              proposalTypeLabel(
                proposal.voting_type
              )
            )}
            ·
            ${escapeHtml(
              proposalVisibilityLabel(
                proposal.voting_visibility
              )
            )}
          </div>

        </div>

        <span class="status ${
          open ? "active" : "pending"
        }">
          ${escapeHtml(
            proposal.status || "Abierta"
          )}
        </span>

      </div>

      ${renderProposalContent(proposal)}

      <div class="proposal-vote-box">

        <div class="proposal-vote-heading">
          <strong>
            ${open ? "Tu voto" : "Resultado"}
          </strong>

          ${
            open &&
            proposal.voting_type === "multiple"
              ? "<span>Podés elegir varias.</span>"
              : ""
          }

        </div>

        <div class="proposal-vote-options">
          ${optionsHtml}
        </div>

        ${
          open
            ? '<button type="button" class="btn btn-primary proposal-save-vote">Guardar voto</button>'
            : ""
        }

        ${renderProposalResults(proposal)}

      </div>

      ${actions}

    </article>
  `;
}

function renderProposals() {
  const list =
    document.getElementById("proposalsList");

  if (!list) {
    return;
  }

  if (!currentProposals.length) {
    list.innerHTML =
      '<div class="empty-state">Todavía no hay propuestas.</div>';
    return;
  }

  list.innerHTML =
    currentProposals
      .map(renderProposalCard)
      .join("");

  list
    .querySelectorAll(".proposal-card")
    .forEach(card => {
      const proposal =
        currentProposals.find(
          item =>
            item.id ===
            card.dataset.proposalId
        );

      if (!proposal) {
        return;
      }

      card
        .querySelectorAll(
          ".proposal-vote-option input"
        )
        .forEach(input => {
          input.addEventListener(
            "change",
            () => {
              const label =
                input.closest(
                  ".proposal-vote-option"
                );

              label?.classList.toggle(
                "selected",
                input.checked
              );
            }
          );
        });

      card
        .querySelector(".proposal-save-vote")
        ?.addEventListener(
          "click",
          async () => {
            const selected = [
              ...card.querySelectorAll(
                "input:checked"
              )
            ].map(input => input.value);

            if (!selected.length) {
              showNotice(
                "Elegí al menos una opción.",
                "error"
              );
              return;
            }

            if (
              proposal.voting_type !== "multiple" &&
              selected.length !== 1
            ) {
              showNotice(
                "Elegí una sola opción.",
                "error"
              );
              return;
            }

            const { error } =
              await replaceMyProposalVotes(
                supabaseClient,
                proposal.id,
                selected
              );

            if (error) {
              showNotice(
                error.message,
                "error"
              );
              return;
            }

            showNotice(
              "Voto guardado.",
              "success"
            );

            await loadProposals();
          }
        );

      card
        .querySelector(".proposal-toggle-status")
        ?.addEventListener(
          "click",
          async () => {
            const nextStatus =
              proposal.status === "Abierta"
                ? "Cerrada"
                : "Abierta";

            const { error } =
              await setProposalStatus(
                supabaseClient,
                proposal.id,
                nextStatus
              );

            if (error) {
              showNotice(
                error.message,
                "error"
              );
              return;
            }

            showNotice(
              nextStatus === "Cerrada"
                ? "Votación cerrada."
                : "Votación reabierta.",
              "success"
            );

            await loadProposals();
          }
        );

      card
        .querySelector(".proposal-delete")
        ?.addEventListener(
          "click",
          async () => {
            const confirmed =
              window.confirm(
                "¿Mover esta propuesta a la papelera?"
              );

            if (!confirmed) {
              return;
            }

            const { error } =
              await deleteProposal(
                supabaseClient,
                proposal.id
              );

            if (error) {
              showNotice(
                error.message,
                "error"
              );
              return;
            }

            showNotice(
              "Propuesta enviada a la papelera.",
              "success"
            );

            await loadProposals();
          }
        );
    });
}

async function loadProposals() {
  const list =
    document.getElementById("proposalsList");

  if (!list || !currentBand) {
    return;
  }

  list.innerHTML =
    '<div class="empty-state">Cargando propuestas...</div>';

  const {
    data: proposals,
    error
  } = await getProposalsByBandId(
    supabaseClient,
    currentBand.id
  );

  if (error) {
    list.innerHTML =
      '<div class="empty-state">No se pudieron cargar las propuestas.</div>';

    showNotice(
      error.message,
      "error"
    );

    return;
  }

  currentProposals =
    proposals || [];

  proposalOptionsMap = {};
  proposalVotesMap = {};
  proposalVoteStatsMap = {};
  proposalProfilesMap = {};
  proposalAttachmentsMap = {};
  proposalBlocksMap = {};

  const proposalIds =
    currentProposals.map(
      proposal => proposal.id
    );

  const authorIds =
    [
      ...new Set(
        currentProposals
          .map(
            proposal =>
              proposal.created_by
          )
          .filter(Boolean)
      )
    ];


  const attachmentsResult =
    await getProposalAttachmentsByProposalIds(
      supabaseClient,
      proposalIds
    );

  if (attachmentsResult.error) {
    showNotice(
      attachmentsResult.error.message,
      "error"
    );
    return;
  }

  const proposalAttachments =
    attachmentsResult.data || [];

  const proposalBlocksResult =
    await getProposalBlocksByProposalIds(
      supabaseClient,
      proposalIds
    );

  if (proposalBlocksResult.error) {
    showNotice(
      proposalBlocksResult.error.message,
      "error"
    );
    return;
  }

  const attachmentsById =
    Object.fromEntries(
      proposalAttachments.map(
        attachment => [
          attachment.id,
          attachment
        ]
      )
    );

  (proposalBlocksResult.data || []).forEach(
    block => {
      (
        proposalBlocksMap[
          block.proposal_id
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

  currentProposals.forEach(
    proposal => {
      if (
        proposalBlocksMap[
          proposal.id
        ]?.length
      ) {
        return;
      }

      const fallback = [];

      if (proposal.detail) {
        fallback.push({
          block_type:
            "text",
          content:
            proposal.detail
        });
      }

      proposalAttachments
        .filter(
          attachment =>
            attachment.proposal_id ===
            proposal.id
        )
        .forEach(
          attachment => {
            fallback.push({
              block_type:
                "attachment",
              attachment_id:
                attachment.id,
              attachment
            });
          }
        );

      proposalBlocksMap[
        proposal.id
      ] = fallback;
    }
  );

  const fileAttachments =
    proposalAttachments.filter(
      attachment =>
        attachment.kind === "file" &&
        attachment.storage_path
    );

  const signedUrlMap = {};

  if (fileAttachments.length) {
    const { data: signedUrls, error: signedError } =
      await supabaseClient
        .storage
        .from("materials")
        .createSignedUrls(
          fileAttachments.map(
            attachment =>
              attachment.storage_path
          ),
          3600
        );

    if (signedError) {
      showNotice(
        signedError.message,
        "error"
      );
      return;
    }

    (signedUrls || []).forEach(item => {
      signedUrlMap[item.path] =
        item.signedUrl;
    });
  }

  proposalAttachments.forEach(attachment => {
    (
      proposalAttachmentsMap[
        attachment.proposal_id
      ] ||= []
    ).push({
      ...attachment,
      signed_url:
        signedUrlMap[
          attachment.storage_path
        ] || null
    });
  });

  Object.values(
    proposalBlocksMap
  ).forEach(
    blocks => {
      blocks.forEach(
        block => {
          if (
            !block.attachment_id
          ) {
            return;
          }

          const attachmentList =
            proposalAttachmentsMap[
              block.proposal_id
            ] || [];

          const attachment =
            attachmentList.find(
              item =>
                item.id ===
                block.attachment_id
            );

          if (attachment) {
            block.attachment =
              attachment;
          }
        }
      );
    }
  );

  const [
    optionsResult,
    votesResult,
    voteStatsResult
  ] = await Promise.all([
    getProposalOptionsByProposalIds(
      supabaseClient,
      proposalIds
    ),
    getProposalVotesByProposalIds(
      supabaseClient,
      proposalIds
    ),
    getProposalVoteStatsByProposalIds(
      supabaseClient,
      proposalIds
    )
  ]);

  const combinedError =
    optionsResult.error ||
    votesResult.error ||
    voteStatsResult.error;

  if (combinedError) {
    showNotice(
      combinedError.message,
      "error"
    );
    return;
  }

  (optionsResult.data || [])
    .forEach(option => {
      (
        proposalOptionsMap[
          option.proposal_id
        ] ||= []
      ).push(option);
    });

  (votesResult.data || [])
    .forEach(vote => {
      (
        proposalVotesMap[
          vote.proposal_id
        ] ||= []
      ).push(vote);
    });

  (voteStatsResult.data || [])
    .forEach(stat => {
      const proposalStats =
        (
          proposalVoteStatsMap[
            stat.proposal_id
          ] ||= {
            totalVoters: Number(
              stat.voter_count || 0
            ),
            byOption: {}
          }
        );

      proposalStats.totalVoters =
        Math.max(
          proposalStats.totalVoters,
          Number(
            stat.voter_count || 0
          )
        );

      proposalStats.byOption[
        stat.option_id
      ] =
        Number(
          stat.vote_count || 0
        );
    });

  const publicProposalIds =
    currentProposals
      .filter(
        proposal =>
          proposal.voting_visibility !==
          "anonymous"
      )
      .map(
        proposal =>
          proposal.id
      );

  const voterIds =
    [
      ...new Set(
        (votesResult.data || [])
          .filter(
            vote =>
              publicProposalIds.includes(
                vote.proposal_id
              )
          )
          .map(
            vote =>
              vote.user_id
          )
          .filter(Boolean)
      )
    ];

  if (voterIds.length) {
    const {
      data: profiles,
      error: profilesError
    } = await supabaseClient
      .from("profiles")
      .select(
        "user_id, display_name, full_name"
      )
      .in(
        "user_id",
        voterIds
      );

    if (profilesError) {
      showNotice(
        profilesError.message,
        "error"
      );
      return;
    }

    (profiles || [])
      .forEach(profile => {
        proposalProfilesMap[
          profile.user_id
        ] = profile;
      });
  }

  renderProposals();

}

document
  .getElementById("showProposalFormBtn")
  ?.addEventListener(
    "click",
    openProposalForm
  );

document
  .getElementById("cancelProposalBtn")
  ?.addEventListener(
    "click",
    resetProposalForm
  );

document
  .getElementById("proposalVotingType")
  ?.addEventListener(
    "change",
    updateProposalTypeUI
  );

document
  .getElementById("proposalVotingVisibility")
  ?.addEventListener(
    "change",
    event => {
      const help =
        document.getElementById(
          "proposalVisibilityHelp"
        );

      if (!help) {
        return;
      }

      help.textContent =
        event.target.value === "anonymous"
          ? "No se muestran los nombres de quienes votan."
          : "Se muestran los nombres de quienes votan en cada opción.";
    }
  );

document
  .getElementById("addProposalOptionBtn")
  ?.addEventListener(
    "click",
    () => {
      const container =
        document.getElementById(
          "proposalOptionsInputs"
        );

      if (!container) {
        return;
      }

      const row =
        document.createElement("div");

      row.className =
        "proposal-option-input-row";

      row.innerHTML = `
        <input
          type="text"
          class="proposal-option-input"
          placeholder="Nueva opción"
          maxlength="120"
        >
        <button
          type="button"
          class="btn btn-subtle btn-danger proposal-remove-option"
          aria-label="Quitar opción"
        >
          ×
        </button>
      `;

      container.appendChild(row);

      row
        .querySelector("button")
        ?.addEventListener(
          "click",
          () => {
            row.remove();
            normalizeProposalOptionInputs();
          }
        );

      normalizeProposalOptionInputs();
    }
  );

document
  .getElementById(
    "insertProposalFileBtn"
  )
  ?.addEventListener(
    "mousedown",
    function() {
      rememberProposalSelection();
    }
  );

document
  .getElementById(
    "insertProposalFileBtn"
  )
  ?.addEventListener(
    "click",
    function() {
      const input =
        document.getElementById(
          "proposalPendingFile"
        );

      if (!input) {
        return;
      }

      input.value = "";
      input.click();
    }
  );

document
  .getElementById(
    "proposalPendingFile"
  )
  ?.addEventListener(
    "change",
    function() {
      const file =
        this.files &&
        this.files[0];

      if (!file) {
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      proposalPendingAttachments[
        pendingKey
      ] = {
        kind:
          "file",
        name:
          file.name,
        file
      };

      const node =
        createProposalInlineAttachment(
          proposalPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertProposalNodeAtSelection(
        node
      );

      this.value = "";
    }
  );

document
  .getElementById(
    "insertProposalLinkBtn"
  )
  ?.addEventListener(
    "mousedown",
    function() {
      rememberProposalSelection();
    }
  );

document
  .getElementById(
    "insertProposalLinkBtn"
  )
  ?.addEventListener(
    "click",
    function() {
      const name =
        window.prompt(
          "Nombre del enlace",
          "Enlace"
        );

      if (name === null) {
        return;
      }

      const url =
        window.prompt(
          "Pegá la URL",
          "https://"
        );

      if (url === null) {
        return;
      }

      const safeUrl =
        normalizeProposalLink(
          url
        );

      if (!safeUrl) {
        showNotice(
          "La URL debe comenzar con http:// o https://.",
          "error"
        );
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      proposalPendingAttachments[
        pendingKey
      ] = {
        kind:
          "link",
        name:
          name.trim() ||
          "Enlace",
        url:
          safeUrl
      };

      const node =
        createProposalInlineAttachment(
          proposalPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertProposalNodeAtSelection(
        node
      );
    }
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();
        rememberProposalSelection();

        insertProposalNodeAtSelection(
          document.createTextNode(
            "\n"
          )
        );

        return;
      }

      if (
        event.key ===
        "Tab"
      ) {
        event.preventDefault();
        rememberProposalSelection();

        insertProposalNodeAtSelection(
          document.createTextNode(
            "  "
          )
        );
      }
    }
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "keyup",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "mouseup",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "focus",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "paste",
    function(event) {
      event.preventDefault();

      const text =
        event.clipboardData?.getData(
          "text/plain"
        ) || "";

      rememberProposalSelection();

      insertProposalNodeAtSelection(
        document.createTextNode(
          text
        )
      );
    }
  );

document
  .getElementById("proposalForm")
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (!currentBand || !currentUser) {
        showNotice(
          "No se encontró la banda o el usuario.",
          "error"
        );
        return;
      }

      const title =
        document
          .getElementById("proposalTitle")
          ?.value
          .trim() || "";

      const proposalBlocks =
        collectProposalComposerBlocks();

      const detail =
        collectProposalLegacyText(
          proposalBlocks
        );

      const votingVisibility =
        document
          .getElementById("proposalVotingVisibility")
          ?.value || "public";

      const votingType =
        document.getElementById(
          "proposalVotingType"
        )?.value || "single";

      let options =
        getProposalOptionLabelsFromForm();

      if (votingType === "yes_no") {
        options = ["Sí", "No"];
      }

      if (!title) {
        showNotice(
          "La propuesta necesita un título.",
          "error"
        );
        return;
      }

      if (options.length < 2) {
        showNotice(
          "Agregá al menos dos opciones.",
          "error"
        );
        return;
      }

      if (
        new Set(
          options.map(
            option =>
              option.toLocaleLowerCase()
          )
        ).size !== options.length
      ) {
        showNotice(
          "No puede haber opciones repetidas.",
          "error"
        );
        return;
      }

      const result =
        await createProposal(
          supabaseClient,
          {
            band_id:
              currentBand.id,
            title,
            detail:
              detail || null,
            status:
              "Abierta",
            voting_type:
              votingType,
            voting_visibility:
              votingVisibility,
            created_by:
              currentUser.id
          },
          options
        );

      if (result.error) {
        showNotice(
          result.error.message,
          "error"
        );
        return;
      }

      const attachmentErrors =
        await saveProposalComposerContent(
          result.data,
          proposalBlocks
        );

      if (attachmentErrors.length) {
        showNotice(
          "La propuesta se publicó, pero algunos adjuntos no se pudieron guardar.",
          "error"
        );
        console.error(
          attachmentErrors.join("\n")
        );
      } else {
        showNotice(
          "Propuesta publicada.",
          "success"
        );
      }

      resetProposalForm();
      await loadProposals();
    }
  );

renderProposalOptionInputs(["", ""]);
updateProposalTypeUI();
