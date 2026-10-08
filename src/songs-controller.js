/* ============================================================
   CANCIONES - CARGA
============================================================ */

async function loadSongs() {

  const {
    data: songs,
    error
  } =
    await getSongsByBand(
      supabaseClient,
      currentBand.id
    );

  if (error) {
    throw error;
  }

  allSongs =
    songs || [];

  songSingersMap = {};

  if (allSongs.length) {

    const ids =
      allSongs.map(
        song =>
          song.id
      );

    const {
      data: singerRows,
      error: singerError
    } =
      await getSongSingersBySongIds(
        supabaseClient,
        ids
      );

    if (singerError) {
      throw singerError;
    }

    (singerRows || [])
      .forEach(row => {

        if (!songSingersMap[row.song_id]) {

          songSingersMap[
            row.song_id
          ] = [];

        }

        songSingersMap[
          row.song_id
        ].push(row);

      });

  }

  populateColorFilter();
  populateSongFilters(
    allSongs,
    getSongSingers,
    uniqueSorted
  );
  renderSongs();

}


/* ============================================================
   CANTANTES NORMALIZADOS
============================================================ */

function getSongSingers(song) {

  const relationRows =
    songSingersMap[
      song.id
    ];

  if (
    relationRows &&
    relationRows.length
  ) {

    return relationRows.map(
      row => ({
        singer:
          row.singer || "",
        song_key:
          row.song_key || ""
      })
    );

  }


  /*
    Compatibilidad con las canciones
    antiguas que todavía usan songs.singer
    y songs.song_key.
  */

  if (
    song.singer &&
    String(song.singer).trim()
  ) {

    return [
      {
        singer:
          String(song.singer).trim(),

        song_key:
          song.song_key ||
          ""
      }
    ];

  }

  return [];

}


/* ============================================================
   FILTROS
============================================================ */

function getFilteredSongs() {

  const filters =
    getSongFilterValues();

  return filterSongs(
    allSongs,
    filters,
    getSongSingers,
    normalizeText
  );

}

async function openSongListsDialog(songId) {
  const song = (allSongs || []).find(item => item.id === songId);
  if (!song) return;

  editingSongListsSongId = songId;

  const dialog = document.getElementById("songListsDialog");
  const title = document.getElementById("songListsDialogTitle");
  const subtitle = document.getElementById("songListsDialogSong");
  const picker = document.getElementById("songListsPicker");
  const saveButton = document.getElementById("saveSongListsBtn");

  title.textContent = "Agregar a lista";
  subtitle.textContent = song.artist
    ? (song.name + " · " + song.artist)
    : song.name;

  picker.innerHTML = '<div class="empty-state">Cargando listas...</div>';
  saveButton.disabled = true;

  const refreshResult = await refreshBandListData();

  if (refreshResult.error) {
    picker.innerHTML =
      '<div class="empty-state">No se pudieron cargar las listas.<br>' +
      escapeHtml(refreshResult.error.message) +
      '</div>';
    return;
  }

  const assignedIds = new Set(getSongListIds(songId));

  const editableLists =
    (currentBandLists || [])
      .filter(
        list =>
          isBandListCreator(list) ||
          window.bandabaseIsAdmin?.()
      );

  if (!editableLists.length) {
    picker.innerHTML =
      '<div class="empty-state">No tenés listas que puedas editar. ' +
      'Solo quien creó una lista o un Administrador puede modificar su repertorio.</div>';
    return;
  }

  picker.innerHTML = editableLists
    .slice()
    .sort((a, b) =>
      String(a.title || "").localeCompare(
        String(b.title || ""),
        "es"
      )
    )
    .map(list => {
      const checked = assignedIds.has(list.id);

      return '<label class="song-list-option">' +
        '<input type="checkbox" data-song-list="' +
        escapeHtml(list.id) + '"' +
        (checked ? " checked" : "") +
        '>' +
        '<span class="song-list-option-name">' +
          escapeHtml(list.title || "Lista") +
        '</span>' +
        '<span class="song-list-option-status">' +
          escapeHtml(list.status || "Planificada") +
        '</span>' +
      '</label>';
    })
    .join("");

  saveButton.disabled = false;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function selectedSongListIds() {
  return Array.from(
    document.querySelectorAll(
      "#songListsPicker input[data-song-list]:checked"
    )
  ).map(input => input.dataset.songList);
}

async function saveSongListAssignments() {
  const songId = editingSongListsSongId;
  const song = (allSongs || []).find(item => item.id === songId);

  if (!song) {
    closeSongListsDialog();
    return;
  }

  const selected = new Set(selectedSongListIds());
  const current = new Set(getSongListIds(songId));

  const toAdd = Array.from(selected).filter(
    listId => !current.has(listId)
  );

  const toRemove = Array.from(current).filter(
    listId => !selected.has(listId)
  );

  for (const listId of toRemove) {
    const result = await removeSongFromBandList(
      supabaseClient,
      listId,
      songId
    );

    if (result.error) {
      await refreshBandListData();
      renderSongs();
      showNotice(result.error.message, "error");
      return;
    }
  }

  for (const listId of toAdd) {
    const position = getNextSongPosition(listId, songId);
    const result = await addSongToBandList(
      supabaseClient,
      listId,
      song,
      position
    );

    if (result.error) {
      await refreshBandListData();
      renderSongs();
      showNotice(result.error.message, "error");
      return;
    }
  }

  await refreshBandListData();

  if (currentBandList) {
    renderBandListDetailContent(
      currentBandList,
      getBandListItems(currentBandList.id)
    );
  }

  renderBandLists();
  renderSongs();
  closeSongListsDialog();

  showNotice(
    toAdd.length || toRemove.length
      ? "Listas de la canción actualizadas."
      : "No hubo cambios en las listas.",
    "success"
  );
}

function closeSongListsDialog() {
  const dialog = document.getElementById("songListsDialog");

  if (dialog?.open && typeof dialog.close === "function") {
    dialog.close();
  } else if (dialog) {
    dialog.removeAttribute("open");
  }

  editingSongListsSongId = null;
}

/* ============================================================
   RENDER CANCIONES
============================================================ */

function renderSongs() {

  const container =
    document.getElementById(
      "songsList"
    );

  const songs =
    getFilteredSongs();

  const compact =
    localStorage.getItem(
      "bandabase.songsCompactView"
    ) === "true";

  container.classList.toggle(
    "compact",
    compact
  );

  const toggleButton =
    document.getElementById(
      "toggleSongsViewBtn"
    );

  if (toggleButton) {
    toggleButton.textContent =
      compact
        ? "Vista completa"
        : "Vista compacta";
  }

  renderSongCards(
    container,
    songs,
    getSongSingers,
    escapeHtml,
    formatDuration,
    openSong,
    openSongListsDialog
  );

}

/* ============================================================
   EVENTOS DE FILTROS
============================================================ */

[
  "filterListStatus",
  "filterActiveStatus"
]
.forEach(id => {

  document
    .getElementById(id)
    .addEventListener(
      "change",
      renderSongs
    );

});

document.addEventListener(
  "click",
  function(event) {

    if (
      !event.target.closest(".filter-multi")
    ) {
      document
        .querySelectorAll(
          ".filter-multi.open"
        )
        .forEach(
          container => {
            container.classList.remove("open");
          }
        );
    }

  }
);


document.getElementById(
  "toggleSongsViewBtn"
).addEventListener(
  "click",
  function() {

    const compact =
      !(
        localStorage.getItem(
          "bandabase.songsCompactView"
        ) === "true"
      );

    localStorage.setItem(
      "bandabase.songsCompactView",
      compact
        ? "true"
        : "false"
    );

    renderSongs();

  }
);


/* ============================================================
   CREAR CANCIÓN - UI
============================================================ */

function showCreateSong() {

  const card =
    document.getElementById(
      "createSongCard"
    );

  const browser =
    document.getElementById(
      "songsBrowser"
    );

  card.classList.remove(
    "hidden"
  );

  browser.classList.add(
    "hidden"
  );

  document.getElementById(
    "songDetail"
  ).classList.add(
    "hidden"
  );


  selectedNewSongColor =
    null;


  renderColorPicker(
    document.getElementById(
      "newSongColorPicker"
    ),
    selectedNewSongColor,
    color => {

      selectedNewSongColor =
        color;

    }
  );


  resetNewSingerRows(
    document.getElementById(
      "newSingersContainer"
    ),
    escapeHtml
  );

  document.getElementById(
    "newSongName"
  ).focus();

}


function hideCreateSong() {

  document.getElementById(
    "createSongCard"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "songsBrowser"
  ).classList.remove(
    "hidden"
  );

}


document.getElementById(
  "showCreateSongBtn"
).addEventListener(
  "click",
  showCreateSong
);


document.getElementById(
  "cancelCreateSongBtn"
).addEventListener(
  "click",
  hideCreateSong
);


document.getElementById(
  "cancelCreateSongBtn2"
).addEventListener(
  "click",
  hideCreateSong
);


/* ============================================================
   CANTANTES - NUEVA CANCIÓN
============================================================ */

document.getElementById(
  "addNewSingerBtn"
).addEventListener(
  "click",
  function() {

    createSingerRow(
      document.getElementById(
        "newSingersContainer"
      ),
      "",
      "",
      escapeHtml
    );

  }
);


/* ============================================================
   CREAR CANCIÓN
============================================================ */

document.getElementById(
  "createSongForm"
).addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    if (!currentBand) {

      showNotice(
        "No se encontró la banda.",
        "error"
      );

      return;
    }


    const {
      name,
      artist,
      genre,
      bpm,
      duration,
      meter,
      color,
      listStatus,
      activeStatus,
      singers
    } =
      readCreateSongForm(
        document,
        selectedNewSongColor,
        parseDuration,
        normalizeText
      );

    if (!name) {

      showNotice(
        "El nombre de la canción es obligatorio.",
        "error"
      );

      return;
    }

    /*
      Compatibilidad con el sistema antiguo:
      si hay exactamente un cantante,
      también guardamos songs.singer
      y songs.song_key.
    */

    const legacySinger =
      singers.length === 1
        ? singers[0].singer
        : null;

    const legacyKey =
      singers.length === 1
        ? singers[0].song_key
        : null;


    const songData = {
      band_id:
        currentBand.id,

      name,

      artist:
        artist || null,

      genre:
        genre || null,

      bpm,

      duration,

      meter,

      color,

      status:
        listStatus,

      active_status:
        activeStatus,

      singer:
        legacySinger,

      song_key:
        legacyKey
    };

    const {
      data: createdSong,
      error: songError
    } =
      await createSong(
        supabaseClient,
        songData
      );

    if (songError) {

      console.error(
        songError
      );

      showNotice(
        songError.message,
        "error"
      );

      return;
    }


    if (singers.length) {

      const {
        error: singersError
      } =
        await createSongSingers(
          supabaseClient,
          createdSong.id,
          singers
        );


      if (singersError) {

        console.error(
          singersError
        );

        showNotice(
          "La canción se creó, pero hubo un problema guardando los cantantes: " +
          singersError.message,
          "error"
        );

      }

    }

    showNotice(
      "Canción creada.",
      "success"
    );


    document.getElementById(
      "createSongForm"
    ).reset();


    hideCreateSong();

    await loadSongs();

    await openSong(
      createdSong.id
    );

  }
);


