let currentProposals = [];
let proposalOptionsMap = {};
let proposalVotesMap = {};
let proposalProfilesMap = {};
let editingProposalId = null;

function proposalTypeLabel(type) {
  if (type === "yes_no") return "Sí / No";
  if (type === "multiple") return "Varias opciones";
  return "Una opción";
}

function getProposalAuthorName(proposal) {
  if (proposal.created_by === currentUser?.id) {
    return currentProfile?.full_name || currentProfile?.display_name || "Vos";
  }
  const profile = proposalProfilesMap[proposal.created_by];
  return profile?.full_name || profile?.display_name || "Integrante";
}

function renderProposalOptionInputs(options = []) {
  const container = document.getElementById("proposalOptionsInputs");
  if (!container) return;

  container.innerHTML = options.map((label, index) => `
    <div class="proposal-option-input-row">
      <input type="text" class="proposal-option-input" value="${escapeHtml(label || "")}" placeholder="Opción ${index + 1}" maxlength="120">
      <button type="button" class="btn btn-subtle btn-danger proposal-remove-option" aria-label="Quitar opción">×</button>
    </div>
  `).join("");

  bindProposalOptionInputEvents();
}

function bindProposalOptionInputEvents() {
  document.querySelectorAll(".proposal-remove-option").forEach(button => {
    button.addEventListener("click", () => {
      const row = button.closest(".proposal-option-input-row");
      row?.remove();
      normalizeProposalOptionInputs();
    });
  });
}

function normalizeProposalOptionInputs() {
  const rows = [...document.querySelectorAll(".proposal-option-input-row")];
  rows.forEach((row, index) => {
    const input = row.querySelector("input");
    if (input) input.placeholder = `Opción ${index + 1}`;
  });
}

function getProposalOptionLabelsFromForm() {
  return [...document.querySelectorAll(".proposal-option-input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function updateProposalTypeUI() {
  const type = document.getElementById("proposalVotingType")?.value;
  const help = document.getElementById("proposalOptionsHelp");
  const addButton = document.getElementById("addProposalOptionBtn");

  if (type === "yes_no") {
    renderProposalOptionInputs(["Sí", "No"]);
    if (addButton) addButton.classList.add("hidden");
    if (help) help.textContent = "La votación tendrá las opciones Sí y No.";
  } else {
    if (addButton) addButton.classList.remove("hidden");
    if (help) help.textContent = type === "multiple"
      ? "Cada integrante puede elegir una o varias opciones."
      : "Cada integrante puede elegir una sola opción.";
  }
}

function resetProposalForm() {
  editingProposalId = null;
  const form = document.getElementById("proposalForm");
  form?.reset();
  document.getElementById("proposalVotingType").value = "single";
  document.getElementById("proposalFormTitle").textContent = "Nueva propuesta";
  document.getElementById("saveProposalBtn").textContent = "Publicar propuesta";
  document.getElementById("cancelProposalBtn").classList.add("hidden");
  renderProposalOptionInputs([""]);
  updateProposalTypeUI();
}

function openProposalForm(proposal = null) {
  editingProposalId = proposal?.id || null;
  document.getElementById("proposalFormTitle").textContent = proposal ? "Editar propuesta" : "Nueva propuesta";
  document.getElementById("saveProposalBtn").textContent = proposal ? "Guardar cambios" : "Publicar propuesta";
  document.getElementById("cancelProposalBtn").classList.toggle("hidden", !proposal);

  document.getElementById("proposalTitle").value = proposal?.title || "";
  document.getElementById("proposalDetail").value = proposal?.detail || "";
  document.getElementById("proposalVotingType").value = proposal?.voting_type || "single";

  const options = proposal ? (proposalOptionsMap[proposal.id] || []).map(option => option.label) : [""];
  renderProposalOptionInputs(options);
  updateProposalTypeUI();
  document.getElementById("proposalForm").classList.remove("hidden");
  document.getElementById("proposalTitle").focus();
}

async function loadProposals() {
  const list = document.getElementById("proposalsList");
  if (!list || !currentBand) return;

  list.innerHTML = '<div class="empty-state">Cargando propuestas...</div>';

  const { data: proposals, error } = await getProposalsByBandId(supabaseClient, currentBand.id);
  if (error) {
    list.innerHTML = '<div class="empty-state">No se pudieron cargar las propuestas.</div>';
    showNotice(error.message, "error");
    return;
  }

  currentProposals = proposals || [];
  proposalOptionsMap = {};
  proposalVotesMap = {};
  proposalProfilesMap = {};

  const ids = currentProposals.map(p => p.id);
  const userIds = [...new Set(currentProposals.map(p => p.created_by).filter(Boolean))];

  const [optionsResult, votesResult, profilesResult] = await Promise.all([
    getProposalOptionsByProposalIds(supabaseClient, ids),
    getProposalVotesByProposalIds(supabaseClient, ids),
    userIds.length
      ? supabaseClient.from("profiles").select("user_id, display_name, full_name").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (optionsResult.error || votesResult.error || profilesResult.error) {
    const error = optionsResult.error || votesResult.error || profilesResult.error;
    showNotice(error.message, "error");
    return;
  }

  (optionsResult.data || []).forEach(option => {
    (proposalOptionsMap[option.proposal_id] ||= []).push(option);
  });

  (votesResult.data || []).forEach(vote => {
    (proposalVotesMap[vote.proposal_id] ||= []).push(vote);
  });

  (profilesResult.data || []).forEach(profile => {
    proposalProfilesMap[profile.user_id] = profile;
  });

  renderProposals();
}

function getProposalVotes(proposalId) {
  return proposalVotesMap[proposalId] || [];
}

function getProposalOptionVotes(proposalId, optionId) {
  return getProposalVotes(proposalId).filter(vote => vote.option_id === optionId);
}

function getMyProposalOptionIds(proposalId) {
  return getProposalVotes(proposalId)
    .filter(vote => vote.user_id === currentUser?.id && vote.option_id)
    .map(vote => vote.option_id);
}

function renderProposalVoteControl(proposal) {
  const options = proposalOptionsMap[proposal.id] || [];
  const myVotes = new Set(getMyProposalOptionIds(proposal.id));
  const disabled = proposal.status !== "Abierta";
  const inputType = proposal.voting_type === "multiple" ? "checkbox" : "radio";

  return options.map(option => `
    <label class="proposal-vote-option ${myVotes.has(option.id) ? "selected" : ""}">
      <input
        type="${inputType}"
        name="proposal-${escapeHtml(proposal.id)}"
        value="${escapeHtml(option.id)}"
        ${myVotes.has(option.id) ? "checked" : ""}
        ${disabled ? "disabled" : ""}
      >
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join("");
}

function renderProposalResults(proposal) {
  const options = proposalOptionsMap[proposal.id] || [];
  const total = getProposalVotes(proposal.id).filter(vote => vote.option_id).length;
  return `
    <div class="proposal-results">
      ${options.map(option => {
        const count = getProposalOptionVotes(proposal.id, option.id).length;
        const percent = total ? Math.round((count / total) * 100) : 0;
        return `
          <div class="proposal-result-row">
            <div class="proposal-result-label">
              <span>${escapeHtml(option.label)}</span>
              <span>${count} (${percent}%)</span>
            </div>
            <div class="proposal-result-bar"><span style="width:${percent}%"></span></div>
          </div>
        `;
      }).join("")}
      <div class="proposal-vote-count">${total} voto${total === 1 ? "" : "s"}</div>
    </div>
  `;
}

function renderProposals() {
  const list = document.getElementById("proposalsList");
  if (!list) return;

  if (!currentProposals.length) {
    list.innerHTML = '<div class="empty-state">Todavía no hay propuestas.</div>';
    return;
  }

  list.innerHTML = currentProposals.map(proposal => `
    <article class="proposal-card">
      <div class="proposal-card-header">
        <div>
          <h3>${escapeHtml(proposal.title)}</h3>
          <div class="proposal-meta">
            ${escapeHtml(getProposalAuthorName(proposal))} · ${escapeHtml(proposalTypeLabel(proposal.voting_type))}
          </div>
        </div>
        <span class="status ${proposal.status === "Abierta" ? "active" : "pending"}">${escapeHtml(proposal.status)}</span>
      </div>

      ${proposal.detail ? `<div class="proposal-detail">${escapeHtml(proposal.detail)}</div>` : ""}

      <div class="proposal-vote-box">
        <div class="proposal-vote-heading">
          <strong>${proposal.status === "Abierta" ? "Tu voto" : "Resultado"}</strong>
          ${proposal.status === "Abierta" && proposal.voting_type === "multiple" ? '<span>Podés elegir varias.</span>' : ""}
        </div>

        <div class="proposal-vote-options" data-proposal-vote-options="${escapeHtml(proposal.id)}">
          ${renderProposalVoteControl(proposal)}
        </div>

        ${proposal.status === "Abierta"
          ? '<button type="button" class="btn btn-primary proposal-save-vote">Guardar voto</button>'
          : renderProposalResults(proposal)}
      </div>

      <div class="proposal-card-actions">
        ${proposal.created_by === currentUser?.id
          ? `
            <button type="button" class="btn btn-subtle proposal-edit">Editar</button>
            <button type="button" class="btn btn-subtle btn-danger proposal-delete">Eliminar</button>
            <button type="button" class="btn btn-subtle proposal-toggle-status">${proposal.status === "Abierta" ? "Cerrar votación" : "Reabrir votación"}</button>
          `
          : ""}
      </div>
    </article>
  `).join("");

  bindProposalEvents();
}

function bindProposalEvents() {
  document.querySelectorAll(".proposal-card").forEach(card => {
    const title = card.querySelector("h3")?.textContent || "";
    const proposal = currentProposals.find(item => item.title === title);
    if (!proposal) return;

    const saveButton = card.querySelector(".proposal-save-vote");
    saveButton?.addEventListener("click", async () => {
      const selected = [...card.querySelectorAll("input[type=radio]:checked, input[type=checkbox]:checked")]
        .map(input => input.value);

      if (proposal.voting_type !== "multiple" && selected.length > 1) return;

      const { error } = await replaceMyProposalVotes(supabaseClient, proposal.id, selected);
      if (error) {
        showNotice(error.message, "error");
        return;
      }

      showNotice("Voto guardado.", "success");
      await loadProposals();
    });

    card.querySelector(".proposal-edit")?.addEventListener("click", () => openProposalForm(proposal));

    card.querySelector(".proposal-delete")?.addEventListener("click", async () => {
      if (!window.confirm("¿Eliminar esta propuesta?")) return;
      const { error } = await deleteProposal(supabaseClient, proposal.id);
      if (error) {
        showNotice(error.message, "error");
        return;
      }
      showNotice("Propuesta eliminada.", "success");
      await loadProposals();
    });

    card.querySelector(".proposal-toggle-status")?.addEventListener("click", async () => {
      const next = proposal.status === "Abierta"
        ? closeProposal(supabaseClient, proposal.id)
        : reopenProposal(supabaseClient, proposal.id);
      const { error } = await next;
      if (error) {
        showNotice(error.message, "error");
        return;
      }
      showNotice(proposal.status === "Abierta" ? "Votación cerrada." : "Votación reabierta.", "success");
      await loadProposals();
    });
  });
}

document.getElementById("showProposalFormBtn")?.addEventListener("click", () => openProposalForm());
document.getElementById("cancelProposalBtn")?.addEventListener("click", resetProposalForm);
document.getElementById("proposalVotingType")?.addEventListener("change", updateProposalTypeUI);
document.getElementById("addProposalOptionBtn")?.addEventListener("click", () => {
  const container = document.getElementById("proposalOptionsInputs");
  const row = document.createElement("div");
  row.className = "proposal-option-input-row";
  row.innerHTML = '<input type="text" class="proposal-option-input" placeholder="Nueva opción" maxlength="120"><button type="button" class="btn btn-subtle btn-danger proposal-remove-option" aria-label="Quitar opción">×</button>';
  container.appendChild(row);
  bindProposalOptionInputEvents();
});

document.getElementById("proposalForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentBand || !currentUser) return;

  const title = document.getElementById("proposalTitle").value.trim();
  const detail = document.getElementById("proposalDetail").value.trim();
  const votingType = document.getElementById("proposalVotingType").value;
  const options = getProposalOptionLabelsFromForm();

  if (!title) {
    showNotice("La propuesta necesita un título.", "error");
    return;
  }

  if (votingType === "yes_no") {
    options.splice(0, options.length, "Sí", "No");
  }

  if (options.length < 2) {
    showNotice("Agregá al menos dos opciones.", "error");
    return;
  }

  if (new Set(options.map(option => option.toLowerCase())).size !== options.length) {
    showNotice("No puede haber opciones repetidas.", "error");
    return;
  }

  const proposalData = {
    band_id: currentBand.id,
    title,
    detail: detail || null,
    voting_type: votingType,
    status: editingProposalId ? undefined : "Abierta",
    created_by: currentUser.id
  };

  const result = editingProposalId
    ? await updateProposal(supabaseClient, editingProposalId, {
        title,
        detail: detail || null,
        voting_type: votingType
      }, options)
    : await createProposal(supabaseClient, proposalData, options);

  if (result.error) {
    showNotice(result.error.message, "error");
    return;
  }

  showNotice(editingProposalId ? "Propuesta actualizada." : "Propuesta publicada.", "success");
  resetProposalForm();
  await loadProposals();
});

resetProposalForm();
