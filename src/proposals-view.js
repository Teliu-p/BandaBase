let proposalRows = [];
let proposalOptions = {};
let proposalVotes = {};

function proposalTypeText(type) {
  return type === "yes_no" ? "Sí / No" : type === "multiple" ? "Varias opciones" : "Una opción";
}

function proposalAuthor(proposal) {
  if (proposal.created_by === currentUser?.id) return currentProfile?.full_name || currentProfile?.display_name || "Vos";
  return "Integrante";
}

function proposalOptionsFromForm() {
  return [...document.querySelectorAll("#proposalOptionsInputs input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function renderProposalInputs(labels) {
  const box = document.getElementById("proposalOptionsInputs");
  box.innerHTML = labels.map((label, i) =>
    '<div class="proposal-option-input-row">' +
      '<input type="text" value="' + escapeHtml(label) + '" maxlength="120" placeholder="Opción ' + (i + 1) + '">' +
      '<button type="button" class="btn btn-subtle btn-danger proposal-remove-option">×</button>' +
    '</div>'
  ).join("");
  box.querySelectorAll(".proposal-remove-option").forEach(button => {
    button.addEventListener("click", () => {
      button.closest(".proposal-option-input-row")?.remove();
    });
  });
}

function updateProposalType() {
  const type = document.getElementById("proposalVotingType").value;
  const add = document.getElementById("addProposalOptionBtn");
  const help = document.getElementById("proposalOptionsHelp");
  if (type === "yes_no") {
    renderProposalInputs(["Sí", "No"]);
    add.classList.add("hidden");
    help.textContent = "La propuesta se votará por Sí o No.";
  } else {
    if (add.classList.contains("hidden")) add.classList.remove("hidden");
    help.textContent = type === "multiple" ? "Cada integrante puede elegir varias opciones." : "Cada integrante puede elegir una opción.";
    if (!document.querySelector("#proposalOptionsInputs input")) renderProposalInputs(["", ""]);
  }
}

function resetProposalForm() {
  document.getElementById("proposalForm").reset();
  document.getElementById("proposalVotingType").value = "single";
  document.getElementById("proposalForm").classList.add("hidden");
  renderProposalInputs(["", ""]);
  updateProposalType();
}

function renderProposalResults(proposal) {
  const options = proposalOptions[proposal.id] || [];
  const votes = proposalVotes[proposal.id] || [];
  const total = votes.length;
  return '<div class="proposal-results">' + options.map(option => {
    const count = votes.filter(v => v.option_id === option.id).length;
    const percent = total ? Math.round(count * 100 / total) : 0;
    return '<div class="proposal-result-row"><div class="proposal-result-label"><span>' +
      escapeHtml(option.label) + '</span><span>' + count + ' (' + percent + '%)</span></div>' +
      '<div class="proposal-result-bar"><span style="width:' + percent + '%"></span></div></div>';
  }).join("") + '<div class="proposal-vote-count">' + total + ' voto' + (total === 1 ? "" : "s") + '</div></div>';
}

function renderProposalCard(proposal) {
  const options = proposalOptions[proposal.id] || [];
  const votes = proposalVotes[proposal.id] || [];
  const myVotes = new Set(votes.filter(v => v.user_id === currentUser?.id).map(v => v.option_id));
  const inputType = proposal.voting_type === "multiple" ? "checkbox" : "radio";
  const open = proposal.status === "Abierta";

  const optionsHtml = options.map(option =>
    '<label class="proposal-vote-option">' +
      '<input type="' + inputType + '" name="proposal-' + escapeHtml(proposal.id) + '" value="' + escapeHtml(option.id) + '"' +
      (myVotes.has(option.id) ? " checked" : "") + (open ? "" : " disabled") + '>' +
      '<span>' + escapeHtml(option.label) + '</span>' +
    '</label>'
  ).join("");

  return '<article class="proposal-card" data-proposal-id="' + escapeHtml(proposal.id) + '">' +
    '<div class="proposal-card-header"><div><h3>' + escapeHtml(proposal.title) + '</h3>' +
    '<div class="proposal-meta">' + escapeHtml(proposalAuthor(proposal)) + ' · ' + escapeHtml(proposalTypeText(proposal.voting_type)) + '</div></div>' +
    '<span class="status ' + (open ? "active" : "pending") + '">' + escapeHtml(proposal.status) + '</span></div>' +
    (proposal.detail ? '<div class="proposal-detail">' + escapeHtml(proposal.detail) + '</div>' : "") +
    '<div class="proposal-vote-box"><strong>' + (open ? "Tu voto" : "Resultado") + '</strong>' +
    (open ? '<div class="proposal-vote-options">' + optionsHtml + '</div><button type="button" class="btn btn-primary proposal-save-vote">Guardar voto</button>' : renderProposalResults(proposal)) +
    '</div>' +
    (proposal.created_by === currentUser?.id ? '<div class="proposal-card-actions"><button type="button" class="btn btn-subtle proposal-toggle-status">' + (open ? "Cerrar votación" : "Reabrir votación") + '</button><button type="button" class="btn btn-subtle btn-danger proposal-delete">Eliminar</button></div>' : "") +
    '</article>';
}

function renderProposals() {
  const list = document.getElementById("proposalsList");
  if (!list) return;
  list.innerHTML = proposalRows.length ? proposalRows.map(renderProposalCard).join("") : '<div class="empty-state">Todavía no hay propuestas.</div>';

  list.querySelectorAll(".proposal-card").forEach(card => {
    const proposal = proposalRows.find(p => p.id === card.dataset.proposalId);
    card.querySelector(".proposal-save-vote")?.addEventListener("click", async () => {
      const selected = [...card.querySelectorAll("input:checked")].map(input => input.value);
      if (proposal.voting_type !== "multiple" && selected.length > 1) return;
      const result = await saveProposalVote(supabaseClient, proposal.id, selected, proposal.voting_type);
      if (result.error) return showNotice(result.error.message, "error");
      showNotice("Voto guardado.", "success");
      await loadProposals();
    });
    card.querySelector(".proposal-toggle-status")?.addEventListener("click", async () => {
      const next = proposal.status === "Abierta" ? "Cerrada" : "Abierta";
      const { error } = await setProposalStatus(supabaseClient, proposal.id, next);
      if (error) return showNotice(error.message, "error");
      await loadProposals();
    });
    card.querySelector(".proposal-delete")?.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta propuesta?")) return;
      const { error } = await deleteProposal(supabaseClient, proposal.id);
      if (error) return showNotice(error.message, "error");
      showNotice("Propuesta eliminada.", "success");
      await loadProposals();
    });
  });
}

async function loadProposals() {
  if (!currentBand) return;
  const list = document.getElementById("proposalsList");
  list.innerHTML = '<div class="empty-state">Cargando propuestas...</div>';
  const result = await getProposalsByBandId(supabaseClient, currentBand.id);
  if (result.error) {
    list.innerHTML = '<div class="empty-state">No se pudieron cargar las propuestas.</div>';
    return showNotice(result.error.message, "error");
  }
  proposalRows = result.data || [];
  proposalOptions = {};
  proposalVotes = {};
  const ids = proposalRows.map(p => p.id);
  const [optionsResult, votesResult] = await Promise.all([
    getProposalOptions(supabaseClient, ids),
    getProposalVotes(supabaseClient, ids)
  ]);
  if (optionsResult.error || votesResult.error) return showNotice((optionsResult.error || votesResult.error).message, "error");
  (optionsResult.data || []).forEach(row => (proposalOptions[row.proposal_id] ||= []).push(row));
  (votesResult.data || []).forEach(row => (proposalVotes[row.proposal_id] ||= []).push(row));
  renderProposals();
}

document.getElementById("showProposalFormBtn")?.addEventListener("click", () => {
  const form = document.getElementById("proposalForm");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) document.getElementById("proposalTitle").focus();
});

document.getElementById("proposalVotingType")?.addEventListener("change", updateProposalType);
document.getElementById("addProposalOptionBtn")?.addEventListener("click", () => {
  const box = document.getElementById("proposalOptionsInputs");
  const row = document.createElement("div");
  row.className = "proposal-option-input-row";
  row.innerHTML = '<input type="text" maxlength="120" placeholder="Nueva opción"><button type="button" class="btn btn-subtle btn-danger proposal-remove-option">×</button>';
  box.appendChild(row);
  row.querySelector("button").addEventListener("click", () => row.remove());
});

document.getElementById("cancelProposalBtn")?.addEventListener("click", resetProposalForm);

document.getElementById("proposalForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentBand || !currentUser) return;
  const title = document.getElementById("proposalTitle").value.trim();
  const detail = document.getElementById("proposalDetail").value.trim();
  const type = document.getElementById("proposalVotingType").value;
  let labels = proposalOptionsFromForm();
  if (type === "yes_no") labels = ["Sí", "No"];
  if (!title) return showNotice("La propuesta necesita un título.", "error");
  if (labels.length < 2) return showNotice("Agregá al menos dos opciones.", "error");
  if (new Set(labels.map(x => x.toLowerCase())).size !== labels.length) return showNotice("No puede haber opciones repetidas.", "error");

  const result = await createProposal(supabaseClient, {
    band_id: currentBand.id,
    title,
    detail: detail || null,
    status: "Abierta",
    voting_type: type,
    created_by: currentUser.id
  }, labels);

  if (result.error) return showNotice(result.error.message, "error");
  showNotice("Propuesta publicada.", "success");
  document.getElementById("proposalForm").reset();
  resetProposalForm();
  await loadProposals();
});

renderProposalInputs(["", ""]);
updateProposalType();
