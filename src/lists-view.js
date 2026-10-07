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

  const timeParts = formatBandListTime(item.list_time).split(":").map(Number);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    timeParts[0] || 0,
    timeParts[1] || 0
  );
}

function bandListMemberName(userId) {
  const member = (allBandMembers || []).find(item => item.user_id === userId);
  return member
    ? (member.display_name || member.profile?.full_name || "Sin nombre")
    : "Sin nombre";
}

function bandListStatusClass(status) {
  return status === "Confirmada" ? "active" : "pending";
}

function getBandListItems(listId) {
  return bandListItemsMap?.[listId] || [];
}

function getBandListSong(songId) {
  return (allSongs || []).find(song => song.id === songId) || null;
}

function renderBandListSongOption(song, selected) {
  const singers = typeof getSongSingers === "function"
    ? getSongSingers(song)
    : [];

  const singersText = singers.length
    ? singers.map(item => {
        const singer = escapeHtml(item.singer || "");
        const key = item.song_key
          ? " (" + escapeHtml(item.song_key) + ")"
          : "";
        return singer + key;
      }).join(", ")
    : "Sin cantante asignado";

  const meta = [
    typeof formatDuration === "function"
      ? formatDuration(song.duration)
      : "—",
    song.meter || "—",
    song.bpm ? song.bpm + " BPM" : "—"
  ].join(" · ");

  const borderStyle = song.color
    ? "border-left-color:" + escapeHtml(song.color) + ";"
    : "";

  return '<label class="list-song-option" style="' + borderStyle + '">' +
    '<input type="checkbox" data-list-song value="' + escapeHtml(song.id) + '"' +
      (selected ? " checked" : "") + '>' +
    '<span class="list-song-content">' +
      '<span class="list-song-title">' + escapeHtml(song.name || "Canción") + '</span>' +
      '<span class="list-song-artist">' + escapeHtml(song.artist || "Artista no especificado") + '</span>' +
      '<span class="list-song-meta">' + escapeHtml(meta) + '</span>' +
      '<span class="list-song-genre">' + escapeHtml(song.genre || "Género no especificado") + '</span>' +
      '<span class="list-song-singers">' + singersText + '</span>' +
    '</span>' +
  '</label>';
}

function renderBandListCard(list) {
  const items = getBandListItems(list.id);
  const songCount = items.filter(item => item.item_type === "song").length;
  const memberCount = items.filter(item => item.item_type === "member").length;

  let html = '<article class="list-card">';
  html += '<div class="list-card-header"><div>';
  html += '<div class="list-card-title">' + escapeHtml(list.title || "Lista") + '</div>';
  html += '<div class="list-card-meta">';
  html += list.list_date ? escapeHtml(formatBandListDate(list.list_date)) : "Sin fecha";
  html += list.list_time ? " · " + escapeHtml(formatBandListTime(list.list_time)) : "";
  html += '</div></div>';
  html += '<div class="detail-actions">';
  html += '<span class="status ' + bandListStatusClass(list.status) + '">' +
    escapeHtml(list.status || "Planificada") +
    '</span>';
  html += '<button type="button" class="btn btn-subtle" data-open-list="' +
    escapeHtml(list.id) + '">Abrir</button>';
  html += '<button type="button" class="btn btn-subtle" data-edit-list="' +
    escapeHtml(list.id) + '">Editar</button>';
  html += '<button type="button" class="btn btn-subtle btn-danger" data-delete-list="' +
    escapeHtml(list.id) + '">Eliminar</button>';
  html += '</div></div>';

  html += '<div class="list-card-summary">';
  html += '<span class="list-summary-chip">Canciones: ' + songCount + '</span>';
  html += '<span class="list-summary-chip">Integrantes: ' + memberCount + '</span>';
  html += '</div>';

  if (list.notes) {
    html += '<div class="rehearsal-card-text">' + escapeHtml(list.notes) + '</div>';
  }

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
    if (timestamp === null || timestamp >= now) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  });

  upcoming.sort((a, b) =>
    (bandListTimestamp(a) ?? Number.MAX_SAFE_INTEGER) -
    (bandListTimestamp(b) ?? Number.MAX_SAFE_INTEGER)
  );
  past.sort((a, b) =>
    (bandListTimestamp(b) ?? 0) -
    (bandListTimestamp(a) ?? 0)
  );

  let html = '<div class="rehearsal-group"><h3>Próximas listas</h3><div class="rehearsal-list">';
  html += upcoming.length
    ? upcoming.map(renderBandListCard).join("")
    : '<div class="empty-state">No hay próximas listas cargadas.</div>';
  html += '</div></div>';

  html += '<div class="rehearsal-group"><h3>Listas anteriores</h3><div class="rehearsal-list">';
  html += past.length
    ? past.map(renderBandListCard).join("")
    : '<div class="empty-state">Todavía no hay listas anteriores.</div>';
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
    container.innerHTML =
      '<div class="empty-state">No se pudieron cargar las listas.<br>' +
      escapeHtml(result.error.message) +
      '</div>';
    showNotice(result.error.message, "error");
    return;
  }

  currentBandLists = result.data || [];
  const ids = currentBandLists.map(item => item.id);
  const itemsResult = await getBandListItemsByListIds(supabaseClient, ids);

  if (itemsResult.error) {
    container.innerHTML =
      '<div class="empty-state">No se pudo cargar el contenido de las listas.<br>' +
      escapeHtml(itemsResult.error.message) +
      '</div>';
    showNotice(itemsResult.error.message, "error");
    return;
  }

  bandListItemsMap = {};
  (itemsResult.data || []).forEach(item => {
    if (!bandListItemsMap[item.list_id]) {
      bandListItemsMap[item.list_id] = [];
    }
    bandListItemsMap[item.list_id].push(item);
  });

  renderBandLists();
}

function selectedListSongs() {
  return Array.from(
    document.querySelectorAll("#bandListSongsPicker input[data-list-song]:checked")
  ).map(input => input.value);
}

function selectedListMembers() {
  const selected = {};

  document
    .querySelectorAll("#bandListMembersPicker input[data-list-member]:checked")
    .forEach(input => {
      const userId = input.dataset.listMember;
      const status = input.closest("label")?.querySelector("select")?.value || "Pendiente";
      selected[userId] = { status };
    });

  return selected;
}

function populateBandListSongsPicker(selectedIds) {
  const picker = document.getElementById("bandListSongsPicker");
  const selected = new Set(selectedIds || []);

  const songs = (allSongs || [])
    .filter(song => song.active_status !== "Inactiva")
    .slice()
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "es")
    );

  picker.innerHTML = songs.length
    ? songs.map(song =>
        renderBandListSongOption(song, selected.has(song.id))
      ).join("")
    : '<div class="empty-state">No hay canciones activas para seleccionar.</div>';
}

function populateBandListMembersPicker(selected) {
  const picker = document.getElementById("bandListMembersPicker");
  const members = allBandMembers || [];

  picker.innerHTML = members.length
    ? members
        .slice()
        .sort((a, b) =>
          String(a.display_name || a.profile?.full_name || "")
            .localeCompare(
              String(b.display_name || b.profile?.full_name || ""),
              "es"
            )
        )
        .map(member => {
          const userId = member.user_id;
          const saved = selected[userId];
          const status = saved?.status || "Pendiente";
          const name = member.display_name ||
            member.profile?.full_name ||
            "Sin nombre";
          const instrument = member.profile?.instrument
            ? ' <span class="member-info">· ' +
              escapeHtml(member.profile.instrument) +
              '</span>'
            : "";

          return '<label class="list-check-option">' +
            '<input type="checkbox" data-list-member="' + escapeHtml(userId) + '"' +
              (saved ? " checked" : "") + '>' +
            '<span>' + escapeHtml(name) + instrument + '</span>' +
            '<select aria-label="Estado de ' + escapeHtml(name) + '">' +
              '<option value="Pendiente" ' +
                (status === "Pendiente" ? "selected" : "") +
              '>Pendiente</option>' +
              '<option value="Confirmado" ' +
                (status === "Confirmado" ? "selected" : "") +
              '>Confirmado</option>' +
              '<option value="Presente" ' +
                (status === "Presente" ? "selected" : "") +
              '>Presente</option>' +
              '<option value="Ausente" ' +
                (status === "Ausente" ? "selected" : "") +
              '>Ausente</option>' +
            '</select>' +
          '</label>';
        })
        .join("")
    : '<div class="empty-state">No hay integrantes activos para seleccionar.</div>';
}

function showBandListForm(list) {
  editingBandListId = list?.id || null;

  const form = document.getElementById("bandListForm");
  form.reset();

  document.getElementById("bandListTitle").value = list?.title || "";
  document.getElementById("bandListDate").value = list?.list_date || "";
  document.getElementById("bandListTime").value = formatBandListTime(list?.list_time);
  document.getElementById("bandListStatus").value = list?.status || "Planificada";
  document.getElementById("bandListNotes").value = list?.notes || "";

  const items = list ? getBandListItems(list.id) : [];
  const songs = items
    .filter(item => item.item_type === "song")
    .sort((a, b) => a.position - b.position)
    .map(item => item.song_id)
    .filter(Boolean);

  const members = {};
  items
    .filter(item => item.item_type === "member" && item.member_user_id)
    .forEach(item => {
      members[item.member_user_id] = {
        status: item.status || "Pendiente"
      };
    });

  populateBandListSongsPicker(songs);
  populateBandListMembersPicker(members);

  document.getElementById("showListFormBtn").textContent =
    list ? "Editando lista" : "+ Nueva lista";
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
    (list.list_time ? " · " + formatBandListTime(list.list_time) : "");
  const status = document.getElementById("listDetailStatus");
  status.textContent = list.status || "Planificada";
  status.className = "status " + bandListStatusClass(list.status);

  renderBandListDetailContent(list, getBandListItems(list.id));
}

function renderBandListDetailContent(list, items) {
  const content = document.getElementById("listDetailContent");

  const groups = [
    ["song", "Repertorio"],
    ["member", "Integrantes y asistencia"]
  ];

  let html = "";

  groups.forEach(([type, label]) => {
    const rows = items
      .filter(item => item.item_type === type)
      .sort((a, b) => a.position - b.position);

    if (!rows.length) return;

    html += '<section class="list-detail-section"><h3>' + label + '</h3>' +
      '<div class="list-detail-list">';

    rows.forEach(item => {
      if (type === "member") {
        const status = item.status || "Pendiente";
        const cls =
          status === "Ausente"
            ? "inactive"
            : (status === "Presente" || status === "Confirmado"
              ? "active"
              : "pending");

        html += '<div class="list-detail-item">' +
          '<div class="list-member-row">' +
            '<strong>' + escapeHtml(bandListMemberName(item.member_user_id)) + '</strong>' +
            '<span class="status ' + cls + '">' + escapeHtml(status) + '</span>' +
          '</div>' +
        '</div>';
        return;
      }

      const song = getBandListSong(item.song_id);
      const title = song?.name || item.title || "Canción";
      const singers = typeof getSongSingers === "function" && song
        ? getSongSingers(song)
        : [];
      const singersText = singers.length
        ? singers.map(singer => {
            const name = escapeHtml(singer.singer || "");
            const key = singer.song_key
              ? " (" + escapeHtml(singer.song_key) + ")"
              : "";
            return name + key;
          }).join(", ")
        : "Sin cantante asignado";

      const meta = song
        ? [
            typeof formatDuration === "function"
              ? formatDuration(song.duration)
              : "—",
            song.meter || "—",
            song.bpm ? song.bpm + " BPM" : "—"
          ].join(" · ")
        : "—";

      html += '<div class="list-detail-item list-song-detail">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        (song?.artist
          ? '<div class="member-info">' + escapeHtml(song.artist) + '</div>'
          : "") +
        '<div class="list-song-meta">' + escapeHtml(meta) + '</div>' +
        (song?.genre
          ? '<div class="list-song-genre">' + escapeHtml(song.genre) + '</div>'
          : "") +
        '<div class="list-song-singers">' + singersText + '</div>' +
      '</div>';
    });

    html += '</div></section>';
  });

  if (list.notes) {
    html += '<section class="list-detail-section">' +
      '<h3>Notas generales</h3>' +
      '<div class="list-notes">' + escapeHtml(list.notes) + '</div>' +
    '</section>';
  }

  content.innerHTML =
    html ||
    '<div class="empty-state">Esta lista todavía no tiene repertorio ni integrantes.</div>';
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

  const items = [];

  selectedListSongs().forEach(songId => {
    const song = getBandListSong(songId);

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

  Object.entries(selectedListMembers()).forEach(([userId, value]) => {
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

  const itemsResult = await replaceBandListItems(supabaseClient, listId, items);

  if (itemsResult.error) {
    showNotice(
      "La lista se guardó, pero no se pudo actualizar su contenido: " +
      itemsResult.error.message,
      "error"
    );
    return;
  }

  const wasEditing = Boolean(editingBandListId);
  hideBandListForm();
  currentBandList = null;

  showNotice(
    wasEditing ? "Lista actualizada." : "Lista creada.",
    "success"
  );

  await loadBandLists();
}

function bindBandListEvents() {
  document.querySelectorAll("[data-open-list]").forEach(button => {
    button.addEventListener("click", () => openBandListDetail(button.dataset.openList));
  });

  document.querySelectorAll("[data-edit-list]").forEach(button => {
    button.addEventListener("click", () => {
      const list = (currentBandLists || []).find(
        item => item.id === button.dataset.editList
      );

      if (list) {
        showBandListForm(list);
      }
    });
  });

  document.querySelectorAll("[data-delete-list]").forEach(button => {
    button.addEventListener("click", async () => {
      const list = (currentBandLists || []).find(
        item => item.id === button.dataset.deleteList
      );

      if (!list) return;

      if (!window.confirm('¿Eliminar la lista "' + list.title + '"?')) {
        return;
      }

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

let bandListsUiInitialized = false;

function initializeBandListsUI() {
  if (bandListsUiInitialized) return;

  document
    .getElementById("showListFormBtn")
    .addEventListener("click", () => showBandListForm());

  document
    .getElementById("cancelBandListBtn")
    .addEventListener("click", hideBandListForm);

  document
    .getElementById("bandListForm")
    .addEventListener("submit", event => {
      event.preventDefault();
      void saveBandList();
    });

  document
    .getElementById("backToListsBtn")
    .addEventListener("click", () => {
      currentBandList = null;
      document.getElementById("listDetail").classList.add("hidden");
      document.getElementById("listsBrowser").classList.remove("hidden");
      renderBandLists();
    });

  document
    .getElementById("editListFromDetailBtn")
    .addEventListener("click", () => {
      if (currentBandList) {
        showBandListForm(currentBandList);
      }
    });

  bandListsUiInitialized = true;
}
