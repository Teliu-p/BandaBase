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

  return {
    data: currentBandLists,
    error: null
  };
}

function isBandListCreator(list) {
  return Boolean(
    list &&
    currentUser &&
    list.created_by ===
      currentUser.id
  );
}

function isBandListManager(list) {
  if (
    !list ||
    !currentUser
  ) {
    return false;
  }

  if (isBandListCreator(list)) {
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
        isBandListCreator(
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
        item.status !==
          "Confirmado"
    ).length;

  const confirmedCount =
    items.filter(
      item =>
        item.item_type ===
          "member" &&
        item.status ===
          "Confirmado"
    ).length;

  let html =
    '<article class="list-card"' +
    (
      isBandListCreator(list)
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
    isBandListCreator(list)
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
      "Solo quien creó la lista puede editarla.",
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
      !isBandListCreator(list)
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
  const content =
    document.getElementById(
      "listDetailContent"
    );

  const repertoire =
    getListSongs(
      list.id
    );

  const members =
    items
      .filter(
        item =>
          item.item_type ===
          "member"
      )
      .sort(
        (a, b) =>
          Number(a.position || 0) -
          Number(b.position || 0)
      );

  const annotated =
    members.filter(
      item =>
        item.status !==
        "Confirmado"
    );

  const confirmed =
    members.filter(
      item =>
        item.status ===
        "Confirmado"
    );

  const selfStatus =
    getBandListParticipantStatus(
      list.id,
      currentUser?.id
    );

  const canManage =
    isBandListManager(
      list
    );

  let html =
    '<section class="list-detail-section">' +
      "<h3>Repertorio</h3>";

  if (repertoire.length) {
    html +=
      '<div class="list-detail-list">';

    html +=
      repertoire
        .map(
          renderRepertoireSong
        )
        .join("");

    html +=
      "</div>";
  } else {
    html +=
      '<div class="list-repertoire-empty">' +
      "Todavía no hay canciones asignadas a esta lista. " +
      "Podés agregarlas desde Canciones con “Agregar a lista”." +
      "</div>";
  }

  html +=
    "</section>";

  html +=
    '<section class="list-detail-section">' +
      "<h3>Integrantes</h3>" +
      '<p class="list-form-help">' +
      "Todos pueden ver quiénes se anotaron. " +
      "El creador y los responsables deciden quién queda confirmado." +
      "</p>";

  if (selfStatus === "Anotado") {
    html +=
      '<div class="list-self-participation">' +
        "<strong>Estás anotado.</strong>" +
        '<button type="button" class="btn btn-subtle" data-list-self-unregister="' +
        escapeHtml(list.id) +
        '">Desanotarme</button>' +
      "</div>";
  } else if (selfStatus === "Confirmado") {
    html +=
      '<div class="list-self-participation">' +
        '<span class="status active">Estás confirmado</span>' +
      "</div>";
  } else {
    html +=
      '<div class="list-self-participation">' +
        "<strong>¿Vas a participar?</strong>" +
        '<button type="button" class="btn btn-primary" data-list-self-register="' +
        escapeHtml(list.id) +
        '">Anotarme</button>' +
      "</div>";
  }

  html +=
    '<div class="list-participant-columns">';

  html +=
    '<div class="list-participant-group">' +
      "<h4>Anotados (" +
      annotated.length +
      ")</h4>";

  if (annotated.length) {
    html +=
      '<div class="list-detail-list">';

    annotated.forEach(
      item => {
        html +=
          '<div class="list-detail-item">' +
            '<div class="list-member-row">' +
              "<strong>" +
              escapeHtml(
                bandListMemberName(
                  item.member_user_id
                )
              ) +
              "</strong>";

        if (canManage) {
          html +=
            '<button type="button" class="btn btn-subtle" data-confirm-list-member="' +
            escapeHtml(item.id) +
            '">Confirmar</button>';
        }

        html +=
            "</div>" +
          "</div>";
      }
    );

    html +=
      "</div>";
  } else {
    html +=
      '<div class="list-repertoire-empty">' +
      "Todavía no hay integrantes anotados." +
      "</div>";
  }

  html +=
    "</div>";

  html +=
    '<div class="list-participant-group">' +
      "<h4>Confirmados (" +
      confirmed.length +
      ")</h4>";

  if (confirmed.length) {
    html +=
      '<div class="list-detail-list">';

    confirmed.forEach(
      item => {
        html +=
          '<div class="list-detail-item">' +
            '<div class="list-member-row">' +
              "<strong>" +
              escapeHtml(
                bandListMemberName(
                  item.member_user_id
                )
              ) +
              "</strong>";

        if (canManage) {
          html +=
            '<button type="button" class="btn btn-subtle btn-danger" data-unconfirm-list-member="' +
            escapeHtml(item.id) +
            '">Quitar confirmación</button>';
        }

        html +=
            "</div>" +
          "</div>";
      }
    );

    html +=
      "</div>";
  } else {
    html +=
      '<div class="list-repertoire-empty">' +
      "Todavía no hay nadie confirmado." +
      "</div>";
  }

  html +=
    "</div>" +
    "</div>";

  const managers =
    getBandListManagers(
      list.id
    );

  html +=
    '<div class="list-participant-managers">' +
      "<strong>Responsables de confirmar:</strong> " +
      (
        managers.length
          ? managers
              .map(
                manager =>
                  escapeHtml(
                    bandListMemberName(
                      manager.user_id
                    )
                  )
              )
              .join(", ")
          : "Solo quien creó la lista"
      ) +
    "</div>";

  html +=
    "</section>";

  if (list.notes) {
    html +=
      '<section class="list-detail-section">' +
        "<h3>Notas generales</h3>" +
        '<div class="list-notes">' +
        escapeHtml(
          list.notes
        ) +
        "</div>" +
      "</section>";
  }

  content.innerHTML =
    html;

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
      null
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
      !isBandListCreator(
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
  document
    .querySelectorAll(
      "[data-list-self-register]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const result =
              await addCurrentUserToBandList(
                supabaseClient,
                button.dataset
                  .listSelfRegister
              );

            if (result.error) {
              showNotice(
                result.error.message,
                "error"
              );
              return;
            }

            await loadBandLists();
            openBandListDetail(
              button.dataset
                .listSelfRegister
            );

            showNotice(
              "Te anotaste en la lista.",
              "success"
            );
          }
        );
      }
    );

  document
    .querySelectorAll(
      "[data-list-self-unregister]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const result =
              await removeCurrentUserFromBandList(
                supabaseClient,
                button.dataset
                  .listSelfUnregister
              );

            if (result.error) {
              showNotice(
                result.error.message,
                "error"
              );
              return;
            }

            await loadBandLists();
            openBandListDetail(
              button.dataset
                .listSelfUnregister
            );

            showNotice(
              "Te desanotaste de la lista.",
              "success"
            );
          }
        );
      }
    );

  document
    .querySelectorAll(
      "[data-confirm-list-member]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const result =
              await setBandListMemberConfirmation(
                supabaseClient,
                button.dataset
                  .confirmListMember,
                "Confirmado"
              );

            if (result.error) {
              showNotice(
                result.error.message,
                "error"
              );
              return;
            }

            await refreshBandListData();

            if (
              currentBandList
            ) {
              currentBandList =
                (
                  currentBandLists ||
                  []
                ).find(
                  list =>
                    list.id ===
                    currentBandList.id
                ) ||
                currentBandList;

              renderBandListDetailContent(
                currentBandList,
                getBandListItems(
                  currentBandList.id
                )
              );
            }

            renderBandLists();

            showNotice(
              "Integrante confirmado.",
              "success"
            );
          }
        );
      }
    );

  document
    .querySelectorAll(
      "[data-unconfirm-list-member]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            const result =
              await setBandListMemberConfirmation(
                supabaseClient,
                button.dataset
                  .unconfirmListMember,
                "Anotado"
              );

            if (result.error) {
              showNotice(
                result.error.message,
                "error"
              );
              return;
            }

            await refreshBandListData();

            if (
              currentBandList
            ) {
              currentBandList =
                (
                  currentBandLists ||
                  []
                ).find(
                  list =>
                    list.id ===
                    currentBandList.id
                ) ||
                currentBandList;

              renderBandListDetailContent(
                currentBandList,
                getBandListItems(
                  currentBandList.id
                )
              );
            }

            renderBandLists();

            showNotice(
              "Confirmación quitada.",
              "success"
            );
          }
        );
      }
    );
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
              isBandListCreator(
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
              !isBandListCreator(
                list
              )
            ) {
              showNotice(
                "Solo quien creó la lista puede eliminarla.",
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
              "Lista eliminada.",
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
