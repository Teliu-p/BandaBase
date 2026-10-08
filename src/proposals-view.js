let currentProposals = [];
let proposalOptionsMap = {};
let proposalVotesMap = {};
let proposalVoteStatsMap = {};
let proposalProfilesMap = {};
let proposalAttachmentsMap = {};
let proposalBlocksMap = {};
let proposalSelectionRange = null;
let proposalPendingAttachments = {};


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

