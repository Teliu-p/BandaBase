function parseBandListDateParts(value) {
  const parts = String(value || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function formatBandListDate(value) {
  const parts = parseBandListDateParts(value);
  if (!parts) return "";
  return new Intl.DateTimeFormat("es-AR").format(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  );
}

function formatBandListTime(value) {
  return String(value || "").slice(0, 5);
}

function bandListTimestamp(item) {
  const parts = parseBandListDateParts(item.list_date);
  if (!parts) return null;
  const time = formatBandListTime(item.list_time).split(":").map(Number);
  return Date.UTC(parts.year, parts.month - 1, parts.day, time[0] || 0, time[1] || 0);
}

function bandListMemberName(userId) {
  const member = (allBandMembers || []).find(item => item.user_id === userId);
  return member
    ? (member.display_name || member.profile?.full_name || "Sin nombre")
    : "Sin nombre";
}

function bandListStatusClass(status) {
  if (status === "Cancelada") return "inactive";
  if (status === "Realizada") return "active";
  return "pending";
}

function parseBandListLines(value) {
  return String(value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
}

function getBandListItems(listId) {
  return bandListItemsMap?.[listId] || [];
}

function renderBandListCard(list) {
  const items = getBandListItems(list.id);
  const count = type => items.filter(item => item.item_type === type).length;
  const chips = [];
  if (count("song")) chips.push("Canciones: " + count("song"));
  if (count("member")) chips.push("Integrantes: " + count("member"));
  if (count("task")) chips.push("Tareas: " + count("task"));
  if (count("equipment") + count("material")) chips.push("Equipo/material: " + (count("equipment") + count("material")));
  if (count("pending")) chips.push("Pendientes: " + count("pending"));

  let html = '<article class="list-card">';
  html += '<div class="list-card-header"><div>';
  html += '<div class="list-card-title">' + escapeHtml(list.title || "Lista") + '</div>';
  html += '<div class="list-card-meta">';
  html += list.list_date ? escapeHtml(formatBandListDate(list.list_date)) : "Sin fecha";
  html += list.list_time ? " · " + escapeHtml(formatBandListTime(list.list_time)) : "";
  html += list.event_type ? " · " + escapeHtml(list.event_type) : "";
  html += '</div></div>';
  html += '<div class="detail-actions">';
  html += '<span class="status ' + bandListStatusClass(list.status) + '">' + escapeHtml(list.status || "Planificada") + '</span>';
  html += '<button type="button" class="btn btn-subtle" data-open-list="' + escapeHtml(list.id) + '">Abrir</button>';
  html += '<button type="button" class="btn btn-subtle" data-edit-list="' + escapeHtml(list.id) + '">Editar</button>';
  html += '<button type="button" class="btn btn-subtle btn-danger" data-delete-list="' + escapeHtml(list.id) + '">Eliminar</button>';
  html += '</div></div>';
  html += '<div class="list-card-summary">';
  html += chips.length
    ? chips.map(chip => '<span class="list-summary-chip">' + escapeHtml(chip) + '</span>').join("")
    : '<span class="list-summary-chip">Sin contenido</span>';
  html += '</div>';
  if (list.notes) html += '<div class="rehearsal-card-text">' + escapeHtml(list.notes) + '</div>';
  html += '</article>';
  return html;
}

function renderBandLists() {
  const container = document.getElementById("listsList");
  if (!container) return;

  const now = Date.now();
  const upcoming = [];
  const past = [];

  (currentBandLists || []).forEach(item => {
    const timestamp = bandListTimestamp(item);
    if (timestamp === null || timestamp >= now) upcoming.push(item);
    else past.push(item);
  });

  upcoming.sort((a,b) => (bandListTimestamp(a) ?? Number.MAX_SAFE_INTEGER) - (bandListTimestamp(b) ?? Number.MAX_SAFE_INTEGER));
  past.sort((a,b) => (bandListTimestamp(b) ?? 0) - (bandListTimestamp(a) ?? 0));

  let html = '<div class="rehearsal-group"><h3>Próximas listas</h3><div class="rehearsal-list">';
  html += upcoming.length ? upcoming.map(renderBandListCard).join("") : '<div class="empty-state">No hay próximas listas cargadas.</div>';
  html += '</div></div>';
  html += '<div class="rehearsal-group"><h3>Listas anteriores</h3><div class="rehearsal-list">';
  html += past.length ? past.map(renderBandListCard).join("") : '<div class="empty-state">Todavía no hay listas anteriores.</div>';
  html += '</div></div>';
  container.innerHTML = html;
  bindBandListEvents();
}

async function loadBandLists() {
  const container = document.getElementById("listsList");
  if (!container || !currentBand) return;
  container.innerHTML = '<div class="empty-state">Cargando listas...</div>';

  const result = await getBandListsByBandId(supabaseClient, currentBand.id);
  if (result.error) {
    container.innerHTML = '<div class="empty-state">No se pudieron cargar las listas.<br>' + escapeHtml(result.error.message) + '</div>';
    showNotice(result.error.message, "error");
    return;
  }

  currentBandLists = result.data || [];
  const ids = currentBandLists.map(item => item.id);
  const itemsResult = await getBandListItemsByListIds(supabaseClient, ids);

  if (itemsResult.error) {
    container.innerHTML = '<div class="empty-state">No se pudo cargar el contenido de las listas.<br>' + escapeHtml(itemsResult.error.message) + '</div>';
    showNotice(itemsResult.error.message, "error");
    return;
  }

  bandListItemsMap = {};
  (itemsResult.data || []).forEach(item => {
    if (!bandListItemsMap[item.list_id]) bandListItemsMap[item.list_id] = [];
    bandListItemsMap[item.list_id].push(item);
  });

  renderBandLists();
}

function selectedListSongs() {
  return Array.from(document.querySelectorAll("#bandListSongsPicker input[data-list-song]:checked")).map(input => input.value);
}

function selectedListMembers() {
  const selected = {};
  document.querySelectorAll("#bandListMembersPicker input[data-list-member]:checked").forEach(input => {
    const userId = input.dataset.listMember;
    const status = document.querySelector('[data-list-member-status="' + CSS.escape(userId) + '"]')?.value || "Pendiente";
    selected[userId] = { status };
  });
  return selected;
}

function populateBandListSongsPicker(selectedIds) {
  const picker = document.getElementById("bandListSongsPicker");
  const selected = new Set(selectedIds || []);
  const songs = (allSongs || []).filter(song => song.active_status !== "Inactiva").slice()
    .sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "es"));

  picker.innerHTML = songs.length
    ? songs.map(song =>
        '<label class="list-check-option">' +
        '<input type="checkbox" data-list-song value="' + escapeHtml(song.id) + '" ' + (selected.has(song.id) ? "checked" : "") + '>' +
        '<span>' + escapeHtml(song.name) + (song.artist ? ' <span class="member-info">· ' + escapeHtml(song.artist) + '</span>' : "") + '</span><span></span></label>'
      ).join("")
    : '<div class="empty-state">No hay canciones activas para seleccionar.</div>';
}

function populateBandListMembersPicker(selected) {
  const picker = document.getElementById("bandListMembersPicker");
  const members = allBandMembers || [];

  picker.innerHTML = members.length
    ? members.slice().sort((a,b) =>
        String(a.display_name || a.profile?.full_name || "")
          .localeCompare(String(b.display_name || b.profile?.full_name || ""), "es")
      ).map(member => {
        const userId = member.user_id;
        const saved = selected[userId];
        const status = saved?.status || "Pendiente";
        return '<label class="list-check-option">' +
          '<input type="checkbox" data-list-member="' + escapeHtml(userId) + '" ' + (saved ? "checked" : "") + '>' +
          '<span>' + escapeHtml(member.display_name || member.profile?.full_name || "Sin nombre") +
          (member.profile?.instrument ? ' <span class="member-info">· ' + escapeHtml(member.profile.instrument) + '</span>' : "") + '</span>' +
          '<select data-list-member-status="' + escapeHtml(userId) + '">' +
          '<option value="Pendiente" ' + (status === "Pendiente" ? "selected" : "") + '>Pendiente</option>' +
          '<option value="Confirmado" ' + (status === "Confirmado" ? "selected" : "") + '>Confirmado</option>' +
          '<option value="Presente" ' + (status === "Presente" ? "selected" : "") + '>Presente</option>' +
          '<option value="Ausente" ' + (status === "Ausente" ? "selected" : "") + '>Ausente</option>' +
          '</select></label>';
      }).join("")
    : '<div class="empty-state">No hay integrantes activos para seleccionar.</div>';
}

function showBandListForm(list) {
  editingBandListId = list?.id || null;
  const form = document.getElementById("bandListForm");
  form.reset();

  document.getElementById("bandListTitle").value = list?.title || "";
  document.getElementById("bandListDate").value = list?.list_date || "";
  document.getElementById("bandListTime").value = formatBandListTime(list?.list_time);
  document.getElementById("bandListEventType").value = list?.event_type || "";
  document.getElementById("bandListStatus").value = list?.status || "Planificada";
  document.getElementById("bandListNotes").value = list?.notes || "";

  const items = list ? getBandListItems(list.id) : [];
  const songs = items.filter(item => item.item_type === "song").sort((a,b) => a.position-b.position).map(item => item.song_id).filter(Boolean);
  const members = {};
  items.filter(item => item.item_type === "member" && item.member_user_id).forEach(item => {
    members[item.member_user_id] = { status: item.status || "Pendiente" };
  });

  document.getElementById("bandListTasks").value = items.filter(item => item.item_type === "task").sort((a,b) => a.position-b.position).map(item => item.title).join("\n");
  document.getElementById("bandListEquipment").value = items.filter(item => item.item_type === "equipment" || item.item_type === "material").sort((a,b) => a.position-b.position).map(item => item.title).join("\n");
  document.getElementById("bandListPending").value = items.filter(item => item.item_type === "pending").sort((a,b) => a.position-b.position).map(item => item.title).join("\n");

  populateBandListSongsPicker(songs);
  populateBandListMembersPicker(members);
  document.getElementById("showListFormBtn").textContent = list ? "Editando lista" : "+ Nueva lista";
  form.classList.remove("hidden");
  document.getElementById("listsBrowser").classList.add("hidden");
  document.getElementById("listDetail").classList.add("hidden");
  document.getElementById("bandListTitle").focus();
}

function hideBandListForm() {
  editingBandListId = null;
  const form = document.getElementById("bandListForm");
  form.classList.add("hidden");
  form.reset();
  document.getElementById("bandListStatus").value = "Planificada";
  document.getElementById("showListFormBtn").textContent = "+ Nueva lista";
  document.getElementById("listsBrowser").classList.remove("hidden");
}

function openBandListDetail(listId) {
  const list = (currentBandLists || []).find(item => item.id === listId);
  if (!list) return;

  currentBandList = list;
  document.getElementById("listsBrowser").classList.add("hidden");
  document.getElementById("bandListForm").classList.add("hidden");
  document.getElementById("listDetail").classList.remove("hidden");
  document.getElementById("listDetailTitle").textContent = list.title || "Lista";
  document.getElementById("listDetailSubtitle").textContent =
    (list.list_date ? formatBandListDate(list.list_date) : "Sin fecha") +
    (list.list_time ? " · " + formatBandListTime(list.list_time) : "") +
    (list.event_type ? " · " + list.event_type : "");
  renderBandListDetailContent(list, getBandListItems(list.id));
}

function renderBandListDetailContent(list, items) {
  const content = document.getElementById("listDetailContent");
  const groups = [
    ["song", "Repertorio"],
    ["member", "Integrantes y asistencia"],
    ["task", "Tareas"],
    ["equipment", "Equipamiento / materiales"],
    ["material", "Materiales"],
    ["pending", "Pendientes"]
  ];

  let html = "";
  groups.forEach(([type, label]) => {
    const rows = items.filter(item => item.item_type === type).sort((a,b) => a.position-b.position);
    if (!rows.length) return;

    html += '<section class="list-detail-section"><h3>' + label + '</h3><div class="list-detail-list">';
    rows.forEach(item => {
      if (type === "member") {
        const status = item.status || "Pendiente";
        const cls = status === "Ausente" ? "inactive" : (status === "Presente" || status === "Confirmado" ? "active" : "pending");
        html += '<div class="list-detail-item"><div class="list-member-row"><strong>' +
          escapeHtml(bandListMemberName(item.member_user_id)) +
          '</strong><span class="status ' + cls + '">' + escapeHtml(status) + '</span></div></div>';
      } else {
        const title = type === "song"
          ? ((allSongs || []).find(song => song.id === item.song_id)?.name || item.title)
          : item.title;
        html += '<div class="list-detail-item">' + escapeHtml(title || "") +
          (item.details ? '<div class="member-info" style="margin-top:3px;">' + escapeHtml(item.details) + '</div>' : "") +
          '</div>';
      }
    });
    html += '</div></section>';
  });

  if (list.notes) {
    html += '<section class="list-detail-section"><h3>Notas generales</h3><div class="list-notes">' + escapeHtml(list.notes) + '</div></section>';
  }

  content.innerHTML = html || '<div class="empty-state">Esta lista todavía no tiene contenido.</div>';
}

async function saveBandList() {
  if (!currentBand || !currentUser) return;

  const title = document.getElementById("bandListTitle").value.trim();
  if (!title) {
    showNotice("El título de la lista es obligatorio.", "error");
    return;
  }

  const listData = {
    title,
    list_date: document.getElementById("bandListDate").value || null,
    list_time: document.getElementById("bandListTime").value || null,
    event_type: document.getElementById("bandListEventType").value.trim() || null,
    status: document.getElementById("bandListStatus").value,
    notes: document.getElementById("bandListNotes").value.trim() || null
  };

  let listId = editingBandListId;
  if (listId) {
    const result = await updateBandList(supabaseClient, listId, listData);
    if (result.error) {
      showNotice(result.error.message, "error");
      return;
    }
  } else {
    const result = await createBandList(supabaseClient, {
      ...listData,
      band_id: currentBand.id,
      created_by: currentUser.id
    });
    if (result.error) {
      showNotice(result.error.message, "error");
      return;
    }
    listId = result.data.id;
  }

  const values = {
    songs: selectedListSongs(),
    members: selectedListMembers()
  };

  const items = [];
  values.songs.forEach(songId => {
    const song = (allSongs || []).find(item => item.id === songId);
    items.push({
      item_type: "song",
      title: song?.name || "Canción",
      details: song?.artist || null,
      song_id: songId,
      member_user_id: null,
      status: null,
      created_by: currentUser.id
    });
  });

  Object.entries(values.members).forEach(([userId, value]) => {
    items.push({
      item_type: "member",
      title: bandListMemberName(userId),
      details: null,
      song_id: null,
      member_user_id: userId,
      status: value.status || "Pendiente",
      created_by: currentUser.id
    });
  });

  parseBandListLines(document.getElementById("bandListTasks").value).forEach(value => {
    items.push({ item_type: "task", title: value, details: null, song_id: null, member_user_id: null, status: "Pendiente", created_by: currentUser.id });
  });

  parseBandListLines(document.getElementById("bandListEquipment").value).forEach(value => {
    items.push({ item_type: "equipment", title: value, details: null, song_id: null, member_user_id: null, status: null, created_by: currentUser.id });
  });

  parseBandListLines(document.getElementById("bandListPending").value).forEach(value => {
    items.push({ item_type: "pending", title: value, details: null, song_id: null, member_user_id: null, status: "Pendiente", created_by: currentUser.id });
  });

  const itemsResult = await replaceBandListItems(supabaseClient, listId, items);
  if (itemsResult.error) {
    showNotice("La lista se guardó, pero no se pudo actualizar su contenido: " + itemsResult.error.message, "error");
    return;
  }

  const wasEditing = Boolean(editingBandListId);
  hideBandListForm();
  currentBandList = null;
  showNotice(wasEditing ? "Lista actualizada." : "Lista creada.", "success");
  await loadBandLists();
}

function bindBandListEvents() {
  document.querySelectorAll("[data-open-list]").forEach(button => {
    button.addEventListener("click", () => openBandListDetail(button.dataset.openList));
  });

  document.querySelectorAll("[data-edit-list]").forEach(button => {
    button.addEventListener("click", () => {
      const list = (currentBandLists || []).find(item => item.id === button.dataset.editList);
      if (list) showBandListForm(list);
    });
  });

  document.querySelectorAll("[data-delete-list]").forEach(button => {
    button.addEventListener("click", async () => {
      const list = (currentBandLists || []).find(item => item.id === button.dataset.deleteList);
      if (!list) return;
      if (!window.confirm('¿Eliminar la lista "' + list.title + '"?')) return;

      const result = await deleteBandList(supabaseClient, list.id);
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }

      showNotice("Lista eliminada.", "success");
      await loadBandLists();
    });
  });
}

document.getElementById("showListFormBtn").addEventListener("click", () => showBandListForm());
document.getElementById("cancelBandListBtn").addEventListener("click", hideBandListForm);
document.getElementById("bandListForm").addEventListener("submit", event => {
  event.preventDefault();
  void saveBandList();
});
document.getElementById("backToListsBtn").addEventListener("click", () => {
  currentBandList = null;
  document.getElementById("listDetail").classList.add("hidden");
  document.getElementById("listsBrowser").classList.remove("hidden");
  renderBandLists();
});
document.getElementById("editListFromDetailBtn").addEventListener("click", () => {
  if (currentBandList) showBandListForm(currentBandList);
});
