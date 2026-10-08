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

function getListSongs(listId) {
  const songIds = getBandListItems(listId)
    .filter(item => item.item_type === "song" && item.song_id)
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map(item => item.song_id);

  const songsById = Object.fromEntries(
    (allSongs || []).map(song => [song.id, song])
  );

  return songIds
    .map(songId => songsById[songId])
    .filter(Boolean);
}

function getSongListIds(songId) {
  return (currentBandLists || [])
    .filter(list =>
      getBandListItems(list.id).some(
        item =>
          item.item_type === "song" &&
          item.song_id === songId
      )
    )
    .map(list => list.id);
}

function getSongListCount(songId) {
  return getSongListIds(songId).length;
}

function getNextSongPosition(listId, songIdToIgnore = null) {
  return getBandListItems(listId)
    .filter(
      item =>
        item.item_type === "song" &&
        item.song_id &&
        item.song_id !== songIdToIgnore
    )
    .reduce(
      (max, item) =>
        Math.max(max, Number.isInteger(item.position) ? item.position : -1),
      -1
    ) + 1;
}

async function refreshBandListData() {
  if (!currentBand) {
    return { data: [], error: null };
  }

  const result = await getBandListsByBandId(
    supabaseClient,
    currentBand.id
  );

  if (result.error) {
    return result;
  }

  currentBandLists =
    result.data || [];

  const ids =
    currentBandLists.map(
      item => item.id
    );

  const [
    itemsResult,
    managersResult
  ] = await Promise.all([
    getBandListItemsByListIds(
      supabaseClient,
      ids
    ),
    getBandListManagersByListIds(
      supabaseClient,
      ids
    )
  ]);

  if (itemsResult.error) {
    return itemsResult;
  }

  if (managersResult.error) {
    return managersResult;
  }

  bandListItemsMap = {};
  bandListManagersMap = {};

  (itemsResult.data || []).forEach(
    item => {
      (
        bandListItemsMap[
          item.list_id
        ] ||= []
      ).push(item);
    }
  );

  (managersResult.data || []).forEach(
    manager => {
      (
        bandListManagersMap[
          manager.list_id
        ] ||= []
      ).push(manager);
    }
  );

  syncSongsRepertoireFromLists();

  return {
    data: currentBandLists,
    error: null
  };
}


function syncSongsRepertoireFromLists() {
  if (!Array.isArray(allSongs)) {
    return;
  }

  allSongs.forEach(
    song => {
      song.in_repertoire =
        getSongListCount(
          song.id
        ) > 0;
    }
  );

  if (currentSong) {
    currentSong.in_repertoire =
      getSongListCount(
        currentSong.id
      ) > 0;
  }
}

function isBandListCreator(list) {
  return Boolean(
    list &&
    currentUser &&
    list.created_by ===
      currentUser.id
  );
}

function isBandListAdmin(list) {
  return Boolean(
    list &&
    window.bandabaseIsAdmin?.()
  );
}

function isBandListEditor(list) {
  return (
    isBandListCreator(list) ||
    isBandListAdmin(list)
  );
}

function isBandListManager(list) {
  if (
    !list ||
    !currentUser
  ) {
    return false;
  }

  if (
    isBandListCreator(list) ||
    isBandListAdmin(list)
  ) {
    return true;
  }

  return (
    bandListManagersMap[
      list.id
    ] || []
  ).some(
    manager =>
      manager.user_id ===
      currentUser.id
  );
}

function getBandListManagers(listId) {
  return (
    bandListManagersMap[
      listId
    ] || []
  );
}

function canCurrentUserEditAnyBandList() {
  return (currentBandLists || [])
    .some(
      list =>
        isBandListEditor(
          list
        )
    );
}

function getBandListParticipantStatus(
  listId,
  userId
) {
  return getBandListItems(listId)
    .find(
      item =>
        item.item_type ===
          "member" &&
        item.member_user_id ===
          userId
    )?.status || null;
}

function getBandMemberInstruments(userId) {
  const member = (allBandMembers || []).find(item => item.user_id === userId);
  const profile = member?.profile || {};
  if (Array.isArray(profile.instruments) && profile.instruments.length) {
    return normalizeBandInstruments(profile.instruments);
  }
  return [];
}

function getBandListMemberItem(listId, userId) {
  return getBandListItems(listId).find(item =>
    item.item_type === "member" &&
    item.member_user_id === userId
  ) || null;
}

function getDefaultBandListSlots() {
  return {
    guitar: 2,
    voice: 2,
    keyboard: 1,
    bass: 1,
    drums: 1
  };
}

function getListInstrumentSlots(list) {
  const slots = list?.instrument_slots || {};
  return Object.fromEntries(
    BAND_INSTRUMENT_OPTIONS.map(option => [
      option.value,
      Math.max(0, Number.parseInt(slots[option.value], 10) || 0)
    ])
  );
}

function selectedListInstrumentSlots() {
  const result = {};
  document.querySelectorAll("[data-list-slot]").forEach(input => {
    const value = Math.max(0, Number.parseInt(input.value, 10) || 0);
    if (value > 0) {
      result[input.dataset.listSlot] = value;
    }
  });
  return result;
}

function populateBandListInstrumentSlotsPicker(slots) {
  const picker = document.getElementById("bandListSlotsPicker");
  if (!picker) return;

  const values = {
    ...getDefaultBandListSlots(),
    ...(slots || {})
  };

  picker.innerHTML = BAND_INSTRUMENT_OPTIONS.map(option => {
    const value = Math.max(0, Number.parseInt(values[option.value], 10) || 0);
    return '<label class="list-instrument-slot">' +
      '<span class="list-instrument-slot-name">' +
      '<span class="list-instrument-icon">' + option.icon + '</span>' +
      escapeHtml(option.label) +
      '</span>' +
      '<input type="number" min="0" max="99" step="1" data-list-slot="' +
      escapeHtml(option.value) + '" value="' + value + '">' +
      '</label>';
  }).join("");
}

function renderParticipationInstrumentPicker(listId, selected = []) {
  const member = getBandListMemberItem(listId, currentUser?.id);
  const profileInstruments = getBandMemberInstruments(currentUser?.id);
  const values = normalizeBandInstruments(selected);
  const available = profileInstruments.length
    ? profileInstruments
    : [];

  if (!available.length) {
    return '<div class="list-form-help">Primero elegí tus instrumentos en <strong>Banda → Mi perfil</strong>.</div>';
  }

  return '<div class="list-participation-instruments">' +
    '<div class="list-form-help">Elegí qué querés hacer en esta fecha. Podés elegir más de uno.</div>' +
    '<div class="list-instrument-choice-grid">' +
    available.map(value => {
      const option = getBandInstrumentOption(value);
      return '<label class="list-instrument-choice">' +
        '<input type="checkbox" data-list-participation-instrument="' + escapeHtml(value) + '"' +
        (values.includes(value) ? ' checked' : '') + '>' +
        '<span>' + option.icon + ' ' + escapeHtml(option.label) + '</span>' +
      '</label>';
    }).join("") +
    '</div></div>';
}

function selectedParticipationInstruments() {
  return Array.from(document.querySelectorAll("[data-list-participation-instrument]:checked"))
    .map(input => input.dataset.listParticipationInstrument);
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
    ? "border-left-color:" + escapeHtml(song.color) + " !important;"
    : "";

  return '<div class="list-detail-item list-song-detail" style="' + borderStyle + '">' +
    '<strong>' + escapeHtml(song.name || "Canción") + '</strong>' +
    (song.artist
      ? '<div class="member-info">' + escapeHtml(song.artist) + '</div>'
      : "") +
    '<div class="list-song-meta">' + escapeHtml(formatSongInfo(song)) + '</div>' +
    (formatSongGenres(song.genre)
      ? '<div class="list-song-genre">' + escapeHtml(formatSongGenres(song.genre)) + '</div>'
      : "") +
    '<div class="list-song-singers">' + formatSongSingers(song) + '</div>' +
  '</div>';
}

function renderBandListCard(list) {
  const items =
    getBandListItems(list.id);

  const repertoire =
    getListSongs(list.id);

  const annotatedCount =
    items.filter(
      item =>
        item.item_type ===
          "member" &&
        item.status !== "Confirmado"
    ).length;

  const confirmedCount =
    items.filter(
      item =>
        item.item_type ===
          "member" &&
        item.status === "Confirmado"
    ).length;

  let html =
    '<article class="list-card"' +
    (
      isBandListEditor(list)
        ? ' data-context-delete="list" data-context-delete-id="' +
          escapeHtml(list.id) +
          '"'
        : ""
    ) +
    ">";

  html +=
    '<div class="list-card-header"><div>';

  html +=
    '<div class="list-card-title">' +
    escapeHtml(
      list.title || "Lista"
    ) +
    "</div>";

  html +=
    '</div><div class="detail-actions">';

  html +=
    '<span class="status ' +
    bandListStatusClass(
      list.status
    ) +
    '">' +
    escapeHtml(
      list.status ||
        "Planificada"
    ) +
    "</span>";

  html +=
    '<button type="button" class="btn btn-subtle" data-open-list="' +
    escapeHtml(list.id) +
    '">Abrir</button>';

  if (
    isBandListEditor(list)
  ) {
    html +=
      '<button type="button" class="btn btn-subtle" data-edit-list="' +
      escapeHtml(list.id) +
      '">Editar</button>';

    html +=
      '<button type="button" class="btn btn-subtle btn-danger" data-delete-list="' +
      escapeHtml(list.id) +
      '">Eliminar</button>';
  }

  html +=
    "</div></div>";

  html +=
    '<div class="list-card-summary">' +
    '<span class="list-summary-chip">Repertorio: ' +
    repertoire.length +
    "</span>" +
    '<span class="list-summary-chip">Anotados: ' +
    annotatedCount +
    "</span>" +
    '<span class="list-summary-chip">Confirmados: ' +
    confirmedCount +
    "</span>" +
    "</div>";

  if (list.notes) {
    html +=
      '<div class="rehearsal-card-text">' +
      escapeHtml(
        list.notes
      ) +
      "</div>";
  }

  html += "</article>";

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

  const result = await refreshBandListData();

  if (result.error) {
    container.innerHTML =
      '<div class="empty-state">No se pudo cargar el contenido de las listas.<br>' +
      escapeHtml(result.error.message) +
      '</div>';

    showNotice(result.error.message, "error");
    return;
  }

  renderBandLists();
  renderSongs();
}

function selectedListManagers() {
  return Array.from(
    document.querySelectorAll(
      "#bandListManagersPicker input[data-list-manager]:checked"
    )
  ).map(
    input =>
      input.dataset.listManager
  );
}

function populateBandListManagersPicker(
  selected
) {
  const picker =
    document.getElementById(
      "bandListManagersPicker"
    );

  if (!picker) {
    return;
  }

  const members =
    (allBandMembers || [])
      .filter(
        member =>
          member.user_id !==
          currentUser?.id
      );

  picker.innerHTML =
    members.length
      ? members
          .slice()
          .sort(
            (a, b) =>
              String(
                a.display_name ||
                a.profile?.full_name ||
                ""
              ).localeCompare(
                String(
                  b.display_name ||
                  b.profile?.full_name ||
                  ""
                ),
                "es"
              )
          )
          .map(
            member => {
              const userId =
                member.user_id;

              const name =
                member.display_name ||
                member.profile?.full_name ||
                "Sin nombre";

              const instrument =
                member.profile?.instrument
                  ? ' <span class="member-info">· ' +
                    escapeHtml(
                      member.profile.instrument
                    ) +
                    "</span>"
                  : "";

              return (
                '<label class="list-check-option">' +
                '<input type="checkbox" data-list-manager="' +
                escapeHtml(userId) +
                '"' +
                (
                  selected.has(
                    userId
                  )
                    ? " checked"
                    : ""
                ) +
                ">" +
                "<span>" +
                escapeHtml(name) +
                instrument +
                "</span>" +
                "</label>"
              );
            }
          )
          .join("")
      : '<div class="empty-state">No hay otros integrantes activos para designar.</div>';
}

function showBandListForm(list) {
  editingBandListId =
    list?.id || null;

  if (
    list &&
    !isBandListCreator(list)
  ) {
    showNotice(
      "No tenés permiso para editar esta lista.",
      "error"
    );
    return;
  }

  const form =
    document.getElementById(
      "bandListForm"
    );

  form.reset();

  document.getElementById(
    "bandListTitle"
  ).value =
    list?.title || "";

  document.getElementById(
    "bandListStatus"
  ).value =
    list?.status ||
    "Planificada";

  document.getElementById(
    "bandListNotes"
  ).value =
    list?.notes || "";

  const selectedManagers =
    new Set(
      getBandListManagers(
        list?.id
      ).map(
        manager =>
          manager.user_id
      )
    );

  populateBandListManagersPicker(
    selectedManagers
  );

  populateBandListInstrumentSlotsPicker(
    list
      ? getListInstrumentSlots(list)
      : getDefaultBandListSlots()
  );

  document.getElementById(
    "showListFormBtn"
  ).textContent =
    list
      ? "Editando lista"
      : "+ Nueva lista";

  form.classList.remove(
    "hidden"
  );

  document.getElementById(
    "listsBrowser"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "listDetail"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "bandListTitle"
  ).focus();
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
  const list =
    (currentBandLists || [])
      .find(
        item =>
          item.id === listId
      );

  if (!list) return;

  currentBandList =
    list;

  document
    .getElementById(
      "listsBrowser"
    )
    .classList.add(
      "hidden"
    );

  document
    .getElementById(
      "bandListForm"
    )
    .classList.add(
      "hidden"
    );

  document
    .getElementById(
      "listDetail"
    )
    .classList.remove(
      "hidden"
    );

  document.getElementById(
    "listDetailTitle"
  ).textContent =
    list.title || "Lista";

  document.getElementById(
    "listDetailSubtitle"
  ).textContent =
    "Creada por " +
    bandListMemberName(
      list.created_by
    );

  const status =
    document.getElementById(
      "listDetailStatus"
    );

  status.textContent =
    list.status ||
    "Planificada";

  status.className =
    "status " +
    bandListStatusClass(
      list.status
    );

  const editButton =
    document.getElementById(
      "editListFromDetailBtn"
    );

  if (editButton) {
    editButton.classList.toggle(
      "hidden",
      !isBandListEditor(list)
    );
  }

  renderBandListDetailContent(
    list,
    getBandListItems(list.id)
  );
}

function renderBandListDetailContent(
  list,
  items
) {
  const content = document.getElementById("listDetailContent");
  const repertoire = getListSongs(list.id);
  const members = items
    .filter(item => item.item_type === "member")
    .sort((a,b) => Number(a.position || 0) - Number(b.position || 0));

  const annotated = members.filter(item => item.status !== "Confirmado");
  const participating = members.filter(item => item.status === "Confirmado");
  const selfItem = getBandListMemberItem(list.id, currentUser?.id);
  const selfStatus = selfItem?.status || null;
  const canManage = isBandListManager(list);
  const slots = getListInstrumentSlots(list);

  let html = '<section class="list-detail-section"><h3>Repertorio</h3>';
  if (repertoire.length) {
    html += '<div class="list-detail-list">' + repertoire.map(renderRepertoireSong).join("") + '</div>';
  } else {
    html += '<div class="list-repertoire-empty">Todavía no hay canciones asignadas a esta lista. Podés agregarlas desde Canciones con “Agregar a lista”.</div>';
  }
  html += '</section>';

  html += '<section class="list-detail-section"><h3>Integrantes</h3>' +
    '<p class="list-form-help">Anotado significa que alguien expresó que está disponible. Participando significa que quedó dentro del cupo de esta fecha.</p>';

  if (selfStatus === "Anotado") {
    html += '<div class="list-self-participation">' +
      '<div><strong>Estás anotado.</strong>' + renderParticipationInstrumentPicker(list.id, selfItem.participation_instruments) + '</div>' +
      '<div class="detail-actions">' +
      '<button type="button" class="btn btn-primary" data-list-self-save-participation="' + escapeHtml(list.id) + '">Guardar participación</button>' +
      '<button type="button" class="btn btn-subtle" data-list-self-unregister="' + escapeHtml(list.id) + '">Desanotarme</button>' +
      '</div></div>';
  } else if (selfStatus === "Confirmado") {
    html += '<div class="list-self-participation">' +
      '<div><span class="status active">Estás participando</span>' +
      '<div class="member-info">' + escapeHtml(formatBandInstruments(selfItem.participation_instruments) || "Sin función") + '</div></div>' +
      '</div>';
  } else {
    html += '<div class="list-self-participation">' +
      '<div><strong>¿Vas a participar?</strong>' +
      renderParticipationInstrumentPicker(list.id, []) +
      '</div>' +
      '<button type="button" class="btn btn-primary" data-list-self-register="' + escapeHtml(list.id) + '">Anotarme</button>' +
      '</div>';
  }

  html += '<div class="list-capacity-grid">';
  BAND_INSTRUMENT_OPTIONS.forEach(option => {
    const limit = slots[option.value];
    const count = members.filter(item =>
      item.status === "Confirmado" &&
      Array.isArray(item.participation_instruments) &&
      item.participation_instruments.includes(option.value)
    ).length;
    html += '<div class="list-capacity-chip"><span>' + option.icon + ' ' + escapeHtml(option.label) + '</span><strong>' + count + '/' + limit + '</strong></div>';
  });
  html += '</div>';

  html += '<div class="list-participant-columns">';

  html += '<div class="list-participant-group"><h4>Anotados (' + annotated.length + ')</h4>';
  if (annotated.length) {
    html += '<div class="list-detail-list">';
    annotated.forEach(item => {
      const instruments = formatBandInstruments(item.participation_instruments) || "Sin función";
      html += '<div class="list-detail-item"><div class="list-member-row">' +
        '<div><strong>' + escapeHtml(bandListMemberName(item.member_user_id)) + '</strong>' +
        '<div class="member-info">' + escapeHtml(instruments) + '</div></div>';
      if (canManage) {
        html += '<button type="button" class="btn btn-subtle" data-confirm-list-member="' + escapeHtml(item.id) + '">Marcar participando</button>';
      }
      html += '</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="list-repertoire-empty">No hay integrantes esperando cupo.</div>';
  }
  html += '</div>';

  html += '<div class="list-participant-group"><h4>Participando (' + participating.length + ')</h4>';
  if (participating.length) {
    html += '<div class="list-detail-list">';
    participating.forEach(item => {
      const instruments = formatBandInstruments(item.participation_instruments) || "Sin función";
      html += '<div class="list-detail-item"><div class="list-member-row">' +
        '<div><strong>' + escapeHtml(bandListMemberName(item.member_user_id)) + '</strong>' +
        '<div class="member-info">' + escapeHtml(instruments) + '</div></div>';
      if (canManage) {
        html += '<button type="button" class="btn btn-subtle btn-danger" data-unconfirm-list-member="' + escapeHtml(item.id) + '">Quitar participación</button>';
      }
      html += '</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="list-repertoire-empty">Todavía no hay nadie participando.</div>';
  }
  html += '</div></div>';

  const managers = getBandListManagers(list.id);
  html += '<div class="list-participant-managers"><strong>Responsables:</strong> ' +
    (managers.length ? managers.map(manager => escapeHtml(bandListMemberName(manager.user_id))).join(", ") : "Solo quien creó la lista") +
    '</div></section>';

  if (list.notes) {
    html += '<section class="list-detail-section"><h3>Notas generales</h3><div class="list-notes">' + escapeHtml(list.notes) + '</div></section>';
  }

  content.innerHTML = html;
  bindBandListParticipantEvents();
}

async function saveBandList() {
  if (
    !currentBand ||
    !currentUser
  ) {
    return;
  }

  const title =
    document.getElementById(
      "bandListTitle"
    ).value.trim();

  if (!title) {
    showNotice(
      "El título de la lista es obligatorio.",
      "error"
    );
    return;
  }

  const listData = {
    title,
    status:
      document.getElementById(
        "bandListStatus"
      ).value,
    notes:
      document.getElementById(
        "bandListNotes"
      ).value.trim() ||
      null,
    instrument_slots:
      selectedListInstrumentSlots()
  };

  let listId =
    editingBandListId;

  if (listId) {
    const existing =
      (currentBandLists || [])
        .find(
          list =>
            list.id ===
            listId
        );

    if (
      !existing ||
      !isBandListEditor(
        existing
      )
    ) {
      showNotice(
        "No tenés permiso para editar esta lista.",
        "error"
      );
      return;
    }

    const result =
      await updateBandList(
        supabaseClient,
        listId,
        listData
      );

    if (result.error) {
      showNotice(
        result.error.message,
        "error"
      );
      return;
    }
  } else {
    const result =
      await createBandList(
        supabaseClient,
        {
          ...listData,
          band_id:
            currentBand.id,
          created_by:
            currentUser.id
        }
      );

    if (result.error) {
      showNotice(
        result.error.message,
        "error"
      );
      return;
    }

    listId =
      result.data.id;
  }

  const managerResult =
    await replaceBandListManagers(
      supabaseClient,
      listId,
      selectedListManagers()
    );

  if (managerResult.error) {
    showNotice(
      "La lista se guardó, pero no se pudieron actualizar sus responsables: " +
      managerResult.error.message,
      "error"
    );
    return;
  }

  const wasEditing =
    Boolean(editingBandListId);

  hideBandListForm();
  currentBandList = null;

  showNotice(
    wasEditing
      ? "Lista actualizada."
      : "Lista creada.",
    "success"
  );

  await loadBandLists();
}

function bindBandListParticipantEvents() {
  document.querySelectorAll("[data-list-self-register]").forEach(button => {
    button.addEventListener("click", async () => {
      const instruments = selectedParticipationInstruments();
      const result = await addCurrentUserToBandList(
        supabaseClient,
        button.dataset.listSelfRegister,
        instruments
      );
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }
      await loadBandLists();
      openBandListDetail(button.dataset.listSelfRegister);
      showNotice("Te anotaste en la lista.", "success");
    });
  });

  document.querySelectorAll("[data-list-self-save-participation]").forEach(button => {
    button.addEventListener("click", async () => {
      const instruments = selectedParticipationInstruments();
      if (!instruments.length) {
        showNotice("Elegí al menos un instrumento.", "error");
        return;
      }
      const result = await updateCurrentUserBandListParticipation(
        supabaseClient,
        button.dataset.listSelfSaveParticipation,
        instruments
      );
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }
      await loadBandLists();
      openBandListDetail(button.dataset.listSelfSaveParticipation || button.dataset.listSelfChangeParticipation);
      showNotice("Participación actualizada.", "success");
    });
  });

  document.querySelectorAll("[data-list-self-unregister]").forEach(button => {
    button.addEventListener("click", async () => {
      const result = await removeCurrentUserFromBandList(supabaseClient, button.dataset.listSelfUnregister);
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }
      await loadBandLists();
      openBandListDetail(button.dataset.listSelfUnregister);
      showNotice("Te desanotaste de la lista.", "success");
    });
  });

  document.querySelectorAll("[data-confirm-list-member]").forEach(button => {
    button.addEventListener("click", async () => {
      const result = await setBandListMemberConfirmation(supabaseClient, button.dataset.confirmListMember, "Confirmado");
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }
      await refreshBandListData();
      if (currentBandList) {
        currentBandList = (currentBandLists || []).find(list => list.id === currentBandList.id) || currentBandList;
        renderBandListDetailContent(currentBandList, getBandListItems(currentBandList.id));
      }
      renderBandLists();
      showNotice("Integrante marcado como participante.", "success");
    });
  });

  document.querySelectorAll("[data-unconfirm-list-member]").forEach(button => {
    button.addEventListener("click", async () => {
      const result = await setBandListMemberConfirmation(supabaseClient, button.dataset.unconfirmListMember, "Anotado");
      if (result.error) {
        showNotice(result.error.message, "error");
        return;
      }
      await refreshBandListData();
      if (currentBandList) {
        currentBandList = (currentBandLists || []).find(list => list.id === currentBandList.id) || currentBandList;
        renderBandListDetailContent(currentBandList, getBandListItems(currentBandList.id));
      }
      renderBandLists();
      showNotice("Participación quitada.", "success");
    });
  });
}

function bindBandListEvents() {
  document
    .querySelectorAll(
      "[data-open-list]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            openBandListDetail(
              button.dataset
                .openList
            )
        );
      }
    );

  document
    .querySelectorAll(
      "[data-edit-list]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const list =
              (
                currentBandLists ||
                []
              ).find(
                item =>
                  item.id ===
                  button.dataset
                    .editList
              );

            if (
              list &&
              isBandListEditor(
                list
              )
            ) {
              showBandListForm(
                list
              );
            } else {
              showNotice(
                "Solo quien creó la lista puede editarla.",
                "error"
              );
            }
          }
        );
      }
    );

  document
    .querySelectorAll(
      "[data-delete-list]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const list =
              (
                currentBandLists ||
                []
              ).find(
                item =>
                  item.id ===
                  button.dataset
                    .deleteList
              );

            if (!list) return;

            if (
              !isBandListEditor(
                list
              )
            ) {
              showNotice(
                "No tenés permiso para mover esta lista a la papelera.",
                "error"
              );
              return;
            }

            if (
              !window.confirm(
                '¿Eliminar la lista "' +
                list.title +
                '"?'
              )
            ) {
              return;
            }

            const result =
              await deleteBandList(
                supabaseClient,
                list.id
              );

            if (result.error) {
              showNotice(
                result.error.message,
                "error"
              );
              return;
            }

            showNotice(
              "Lista enviada a la papelera.",
              "success"
            );

            await loadBandLists();
          }
        );
      }
    );
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
