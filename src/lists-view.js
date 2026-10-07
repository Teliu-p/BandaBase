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

function getRepertoireSongs() {
  return (allSongs || [])
    .filter(song => song.list_status === "Lista")
    .slice()
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "es")
    );
}

function formatSongInfo(song) {
  const parts = [];

  if (typeof formatDuration === "function") {
    parts.push(formatDuration(song.duration));
  }

  parts.push(song.meter || "—");
  parts.push(song.bpm ? song.bpm + " BPM" : "—");

  return parts.join(" · ");
}

function formatSongSingers(song) {
  const singers =
    typeof getSongSingers === "function"
      ? getSongSingers(song)
      : [];

  if (!singers.length) {
    return "Sin cantante asignado";
  }

  return singers.map(item => {
    const name = escapeHtml(item.singer || "");
    const key = item.song_key
      ? " (" + escapeHtml(item.song_key) + ")"
      : "";
    return name + key;
  }).join(", ");
}

function renderRepertoireSong(song) {
  const borderStyle = song.color
    ? "border-left-color:" + escapeHtml(song.color) + ";"
    : "";

  return '<div class="list-detail-item list-song-detail" style="' + borderStyle + '">' +
    '<strong>' + escapeHtml(song.name || "Canción") + '</strong>' +
    (song.artist
      ? '<div class="member-info">' + escapeHtml(song.artist) + '</div>'
      : "") +
    '<div class="list-song-meta">' + escapeHtml(formatSongInfo(song)) + '</div>' +
    (song.genre
      ? '<div class="list-song-genre">' + escapeHtml(song.genre) + '</div>'
      : "") +
    '<div class="list-song-singers">' + formatSongSingers(song) + '</div>' +
  '</div>';
}

function renderBandListCard(list) {
  const items = getBandListItems(list.id);
  const repertoire = getRepertoireSongs();
  const memberCount = items.filter(item => item.item_type === "member").length;

  let html = '<article class="list-card">';
  html += '<div class="list-card-header"><div>';
  html += '<div class="list-card-title">' + escapeHtml(list.title || "Lista") + '</div>';
  html += '</div><div class="detail-actions">';

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
  html += '<span class="list-summary-chip">Repertorio: ' + repertoire.length + '</span>';
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

  const lists = (currentBandLists || []).slice().sort((a, b) => {
    const aTime = Date.parse(a.created_at || "") || 0;
    const bTime = Date.parse(b.created_at || "") || 0;
    return bTime - aTime;
  });

  const html = lists.length
    ? '<div class="rehearsal-list">' +
      lists.map(renderBandListCard).join("") +
      '</div>'
    : '<div class="empty-state">Todavía no hay listas cargadas.</div>';

  container.innerHTML = html;
  bindBandListEvents();
}

async function loadBandLists() {
  const container = document.getElementById("listsList");
  if (!container || !currentBand) return;

  container.innerHTML = '<div class="empty-state">Cargando listas...</div>';

  const result = await getBandListsByBandId(
    supabaseClient,
    currentBand.id
  );

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
  const itemsResult = await getBandListItemsByListIds(
    supabaseClient,
    ids
  );

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

function selectedListMembers() {
  const selected = {};

  document
    .querySelectorAll("#bandListMembersPicker input[data-list-member]:checked")
    .forEach(input => {
      const userId = input.dataset.listMember;
      const status =
        input.closest("label")?.querySelector("select")?.value ||
        "Pendiente";

      selected[userId] = { status };
    });

  return selected;
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

          const name =
            member.display_name ||
            member.profile?.full_name ||
            "Sin nombre";

          const instrument = member.profile?.instrument
            ? ' <span class="member-info">· ' +
              escapeHtml(member.profile.instrument) +
              '</span>'
            : "";

          return '<label class="list-check-option">' +
            '<input type="checkbox" data-list-member="' +
              escapeHtml(userId) + '"' +
              (saved ? " checked" : "") +
            '>' +
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
  document.getElementById("bandListStatus").value =
    list?.status || "Planificada";
  document.getElementById("bandListNotes").value =
    list?.notes || "";

  const items = list ? getBandListItems(list.id) : [];
  const members = {};

  items
    .filter(item => item.item_type === "member" && item.member_user_id)
    .forEach(item => {
      members[item.member_user_id] = {
        status: item.status || "Pendiente"
      };
    });

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
  document.getElementById("showListFormBtn").textContent =
    "+ Nueva lista";

  document.getElementById("listsBrowser").classList.remove("hidden");
}

function openBandListDetail(listId) {
  const list = (currentBandLists || []).find(
    item => item.id === listId
  );

  if (!list) return;

  currentBandList = list;

  document.getElementById("listsBrowser").classList.add("hidden");
  document.getElementById("bandListForm").classList.add("hidden");
  document.getElementById("listDetail").classList.remove("hidden");

  document.getElementById("listDetailTitle").textContent =
    list.title || "Lista";

  document.getElementById("listDetailSubtitle").textContent = "";

  const status = document.getElementById("listDetailStatus");
  status.textContent = list.status || "Planificada";
  status.className =
    "status " + bandListStatusClass(list.status);

  renderBandListDetailContent(
    list,
    getBandListItems(list.id)
  );
}

function renderBandListDetailContent(list, items) {
  const content = document.getElementById("listDetailContent");
  const repertoire = getRepertoireSongs();

  let html =
    '<section class="list-detail-section">' +
      '<h3>Repertorio</h3>';

  if (repertoire.length) {
    html += '<div class="list-detail-list">';
    html += repertoire.map(renderRepertoireSong).join("");
    html += '</div>';
  } else {
    html +=
      '<div class="list-repertoire-empty">' +
      'Todavía no hay canciones añadidas al repertorio. ' +
      'Podés agregarlas desde la sección Canciones.' +
      '</div>';
  }

  html += '</section>';

  const members = items
    .filter(item => item.item_type === "member")
    .sort((a, b) => a.position - b.position);

  html +=
    '<section class="list-detail-section">' +
      '<h3>Integrantes y asistencia</h3>';

  if (members.length) {
    html += '<div class="list-detail-list">';

    members.forEach(item => {
      const status = item.status || "Pendiente";
      const cls =
        status === "Ausente"
          ? "inactive"
          : (
              status === "Presente" || status === "Confirmado"
                ? "active"
                : "pending"
            );

      html +=
        '<div class="list-detail-item">' +
          '<div class="list-member-row">' +
            '<strong>' +
              escapeHtml(
                bandListMemberName(item.member_user_id)
              ) +
            '</strong>' +
            '<span class="status ' +
              cls +
            '">' +
              escapeHtml(status) +
            '</span>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
  } else {
    html +=
      '<div class="list-repertoire-empty">' +
      'Todavía no hay integrantes asignados a esta lista.' +
      '</div>';
  }

  html += '</section>';

  if (list.notes) {
    html +=
      '<section class="list-detail-section">' +
        '<h3>Notas generales</h3>' +
        '<div class="list-notes">' +
          escapeHtml(list.notes) +
        '</div>' +
      '</section>';
  }

  content.innerHTML = html;
}

async function saveBandList() {
  if (!currentBand || !currentUser) return;

  const title =
    document.getElementById("bandListTitle").value.trim();

  if (!title) {
    showNotice(
      "El título de la lista es obligatorio.",
      "error"
    );
    return;
  }

  const listData = {
    title,
    status: document.getElementById("bandListStatus").value,
    notes:
      document.getElementById("bandListNotes").value.trim() ||
      null
  };

  let listId = editingBandListId;

  if (listId) {
    const result = await updateBandList(
      supabaseClient,
      listId,
      listData
    );

    if (result.error) {
      showNotice(result.error.message, "error");
      return;
    }
  } else {
    const result = await createBandList(
      supabaseClient,
      {
        ...listData,
        band_id: currentBand.id,
        created_by: currentUser.id
      }
    );

    if (result.error) {
      showNotice(result.error.message, "error");
      return;
    }

    listId = result.data.id;
  }

  const items = [];

  Object.entries(selectedListMembers()).forEach(
    ([userId, value]) => {
      items.push({
        item_type: "member",
        title: bandListMemberName(userId),
        details: null,
        song_id: null,
        member_user_id: userId,
        status: value.status || "Pendiente",
        created_by: currentUser.id
      });
    }
  );

  const itemsResult = await replaceBandListItems(
    supabaseClient,
    listId,
    items
  );

  if (itemsResult.error) {
    showNotice(
      "La lista se guardó, pero no se pudo actualizar sus integrantes: " +
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
  document
    .querySelectorAll("[data-open-list]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => openBandListDetail(button.dataset.openList)
      );
    });

  document
    .querySelectorAll("[data-edit-list]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const list = (currentBandLists || []).find(
            item => item.id === button.dataset.editList
          );

          if (list) {
            showBandListForm(list);
          }
        }
      );
    });

  document
    .querySelectorAll("[data-delete-list]")
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const list = (currentBandLists || []).find(
            item => item.id === button.dataset.deleteList
          );

          if (!list) return;

          if (
            !window.confirm(
              '¿Eliminar la lista "' + list.title + '"?'
            )
          ) {
            return;
          }

          const result = await deleteBandList(
            supabaseClient,
            list.id
          );

          if (result.error) {
            showNotice(result.error.message, "error");
            return;
          }

          showNotice("Lista eliminada.", "success");
          await loadBandLists();
        }
      );
    });
}

let bandListsUiInitialized = false;

function initializeBandListsUI() {
  if (bandListsUiInitialized) return;

  document
    .getElementById("showListFormBtn")
    .addEventListener(
      "click",
      () => showBandListForm()
    );

  document
    .getElementById("cancelBandListBtn")
    .addEventListener(
      "click",
      hideBandListForm
    );

  document
    .getElementById("bandListForm")
    .addEventListener(
      "submit",
      event => {
        event.preventDefault();
        void saveBandList();
      }
    );

  document
    .getElementById("backToListsBtn")
    .addEventListener(
      "click",
      () => {
        currentBandList = null;

        document
          .getElementById("listDetail")
          .classList.add("hidden");

        document
          .getElementById("listsBrowser")
          .classList.remove("hidden");

        renderBandLists();
      }
    );

  document
    .getElementById("editListFromDetailBtn")
    .addEventListener(
      "click",
      () => {
        if (currentBandList) {
          showBandListForm(currentBandList);
        }
      }
    );

  bandListsUiInitialized = true;
}
