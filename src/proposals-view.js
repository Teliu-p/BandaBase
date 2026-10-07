let currentProposals = [];
let proposalOptionsMap = {};
let proposalVotesMap = {};
let proposalProfilesMap = {};
let proposalAttachmentsMap = {};


function getProposalAttachments(proposalId) {
  return proposalAttachmentsMap[proposalId] || [];
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
    const url = new URL(
      String(value || "").trim()
    );

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


function renderProposalAttachments(proposal) {
  const attachments =
    getProposalAttachments(proposal.id);

  if (!attachments.length) {
    return "";
  }

  const items =
    attachments
      .map(
        attachment => {

          if (attachment.kind === "link") {
            const href =
              normalizeProposalLink(
                attachment.url
              );

            if (!href) {
              return "";
            }

            return (
              '<a class="proposal-attachment proposal-attachment-link" href="' +
              escapeHtml(href) +
              '" target="_blank" rel="noopener noreferrer">' +
              '<span>' +
              escapeHtml(
                attachment.title || href
              ) +
              '</span>' +
              '<small>Enlace externo ↗</small>' +
              '</a>'
            );
          }

          if (!attachment.signed_url) {
            return (
              '<div class="proposal-attachment proposal-attachment-file">' +
              '<span>' +
              escapeHtml(
                attachment.file_name ||
                attachment.title ||
                "Archivo"
              ) +
              '</span>' +
              '<small>Archivo no disponible</small>' +
              '</div>'
            );
          }

          return (
            '<a class="proposal-attachment proposal-attachment-file" href="' +
            escapeHtml(attachment.signed_url) +
            '" target="_blank" rel="noopener noreferrer">' +
            '<span>' +
            escapeHtml(
              attachment.file_name ||
              attachment.title ||
              "Archivo"
            ) +
            '</span>' +
            '<small>' +
            escapeHtml(
              formatProposalFileSize(
                attachment.file_size
              ) || "Archivo adjunto"
            ) +
            '</small>' +
            '</a>'
          );
        }
      )
      .filter(Boolean)
      .join("");

  if (!items) {
    return "";
  }

  return (
    '<div class="proposal-attachments">' +
      '<div class="proposal-attachments-title">Adjuntos y enlaces</div>' +
      '<div class="proposal-attachments-list">' +
        items +
      '</div>' +
    '</div>'
  );
}


async function saveProposalAttachments(
  proposal,
  files,
  linkValues
) {
  const errors = [];

  for (const file of Array.from(files || [])) {
    const cleanName =
      sanitizeProposalFileName(
        file.name
      );

    const path =
      currentBand.id +
      "/proposals/" +
      proposal.id +
      "/" +
      crypto.randomUUID() +
      "_" +
      cleanName;

    const { error: uploadError } =
      await supabaseClient
        .storage
        .from("materials")
        .upload(
          path,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              file.type ||
              "application/octet-stream"
          }
        );

    if (uploadError) {
      errors.push(
        "No se pudo subir " +
        file.name +
        ": " +
        uploadError.message
      );
      continue;
    }

    const { error: rowError } =
      await createProposalAttachment(
        supabaseClient,
        {
          proposal_id: proposal.id,
          band_id: currentBand.id,
          kind: "file",
          title: file.name,
          file_name: file.name,
          storage_path: path,
          url: null,
          mime_type:
            file.type ||
            null,
          file_size: file.size,
          created_by: currentUser.id
        }
      );

    if (rowError) {
      await supabaseClient
        .storage
        .from("materials")
        .remove([path]);

      errors.push(
        "No se pudo registrar " +
        file.name +
        ": " +
        rowError.message
      );
    }
  }

  const uniqueLinks =
    Array.from(
      new Set(
        (linkValues || [])
          .map(normalizeProposalLink)
          .filter(Boolean)
      )
    );

  for (const href of uniqueLinks) {
    const { error } =
      await createProposalAttachment(
        supabaseClient,
        {
          proposal_id: proposal.id,
          band_id: currentBand.id,
          kind: "link",
          title: href,
          file_name: null,
          storage_path: null,
          url: href,
          mime_type: null,
          file_size: null,
          created_by: currentUser.id
        }
      );

    if (error) {
      errors.push(
        "No se pudo guardar el enlace " +
        href +
        ": " +
        error.message
      );
    }
  }

  return errors;
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

  const voterIds =
    new Set(
      votes
        .map(vote => vote.user_id)
        .filter(Boolean)
    );

  const totalVoters =
    voterIds.size;

  return `
    <div class="proposal-results">

      <div class="proposal-meta">
        ${totalVoters} integrante${totalVoters === 1 ? "" : "s"} votaron
      </div>

      ${
        options.length
          ? options
              .map(option => {
                const optionVotes =
                  getProposalOptionVotes(
                    proposal.id,
                    option.id
                  );

                const count =
                  optionVotes.length;

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
                  optionVotes.length
                ) {
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
                    escapeHtml(names.join(", ")) +
                    "</div>";
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

  const actions =
    proposal.created_by === currentUser?.id
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

      ${
        proposal.detail
          ? `
            <div class="proposal-detail">
              ${escapeHtml(proposal.detail)}
            </div>
          `
          : ""
      }

      ${renderProposalAttachments(proposal)}

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
                "¿Eliminar esta propuesta?"
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
              "Propuesta eliminada.",
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
  proposalProfilesMap = {};
  proposalAttachmentsMap = {};

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

  const [
    optionsResult,
    votesResult
  ] = await Promise.all([
    getProposalOptionsByProposalIds(
      supabaseClient,
      proposalIds
    ),
    getProposalVotesByProposalIds(
      supabaseClient,
      proposalIds
    )
  ]);

  const combinedError =
    optionsResult.error ||
    votesResult.error;

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

      const detail =
        document
          .getElementById("proposalDetail")
          ?.value
          .trim() || "";

      const proposalFiles =
        document.getElementById(
          "proposalFiles"
        )?.files || [];

      const proposalLinks =
        document
          .getElementById(
            "proposalLinks"
          )
          ?.value
          .split("\n")
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean) || [];

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
        await saveProposalAttachments(
          result.data,
          proposalFiles,
          proposalLinks
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
