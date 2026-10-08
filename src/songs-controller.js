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


/* ============================================================
   ABRIR CANCIÓN
============================================================ */

async function openSong(
  songId
) {

  let song =
    allSongs.find(
      item =>
        item.id === songId
    );


  if (!song) {

    const {
      data,
      error
    } =
      await getSongById(
        supabaseClient,
        songId
      );

    if (error) {
      showNotice(
        error.message,
        "error"
      );
      return;
    }

    song = data;

  }


  currentSong =
    song;

  currentMaterials = [];

  openMaterialIds =
    new Set();

  hideMaterialForm();

  resetCommentForm();

  currentComments = [];

  loadMaterials();

  loadComments();

  loadOriginalComparisonMaterial();


  document.getElementById(
    "songsBrowser"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "createSongCard"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "songDetail"
  ).classList.remove(
    "hidden"
  );


  document.getElementById(
    "detailTitle"
  ).textContent =
    song.name || "Canción";


  document.getElementById(
    "detailSubtitle"
  ).textContent =
    song.artist ||
    "Artista no especificado";


  document.getElementById(
    "detailName"
  ).value =
    song.name || "";


  document.getElementById(
    "detailArtist"
  ).value =
    song.artist || "";


  document.getElementById(
    "detailGenre"
  ).value =
    song.genre || "";


  document.getElementById(
    "detailBpm"
  ).value =
    song.bpm ?? "";


  document.getElementById(
    "detailDuration"
  ).value =
    formatDuration(
      song.duration
    );


  document.getElementById(
    "detailMeter"
  ).value =
    song.meter || "";


  document.getElementById(
    "detailRepertoire"
  ).checked =
    typeof getSongListCount === "function"
      ? getSongListCount(song.id) > 0
      : Boolean(song.in_repertoire);


  document.getElementById(
    "detailListStatus"
  ).value =
    song.status || "Pendiente";


  document.getElementById(
    "detailActiveStatus"
  ).value =
    song.active_status ||
    "Activa";


  selectedDetailSongColor =
    song.color || null;


  renderColorPicker(
    document.getElementById(
      "detailColorPicker"
    ),
    selectedDetailSongColor,
    color => {

      selectedDetailSongColor =
        color;

    }
  );


  const singers =
    getSongSingers(song);


  renderDetailSingers(
    document.getElementById(
      "detailSingersContainer"
    ),
    singers,
    escapeHtml
  );


  loadComparison(
    song
  );

}


/* ============================================================
   DETALLE - CANTANTES
============================================================ */

document.getElementById(
  "addDetailSingerBtn"
).addEventListener(
  "click",
  function() {

    createSingerRow(
      document.getElementById(
        "detailSingersContainer"
      ),
      "",
      "",
      escapeHtml
    );

  }
);


/* ============================================================
   GUARDAR DETALLE
============================================================ */

document.getElementById(
  "songDetailForm"
).addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    if (!currentSong) {
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
      singers,
      originalBpm,
      originalKey,
      originalDuration,
      originalMeter
    } =
      readSongDetailForm(
        document,
        selectedDetailSongColor,
        parseDuration,
        normalizeText
      );

    if (!name) {

      showNotice(
        "El nombre es obligatorio.",
        "error"
      );

      return;
    }


    const legacySinger =
      singers.length === 1
        ? singers[0].singer
        : null;

    const legacyKey =
      singers.length === 1
        ? singers[0].song_key
        : null;

    const songData = {
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
        legacyKey,

      original_bpm:
        originalBpm,

      original_key:
        originalKey || null,

      original_duration:
        originalDuration,

      original_meter:
        originalMeter || null
    };

    const {
      error: updateError
    } =
      await updateSong(
        supabaseClient,
        currentSong.id,
        songData
      );

    if (updateError) {

      console.error(
        updateError
      );

      showNotice(
        updateError.message,
        "error"
      );

      return;
    }


    /*
      Actualizamos la relación estructurada.

      Primero borramos las relaciones actuales
      y luego insertamos las que quedaron en pantalla.
    */

    const {
      error: singersError
    } =
      await replaceSongSingers(
        supabaseClient,
        currentSong.id,
        singers
      );

    if (singersError) {

      showNotice(
        singersError.message,
        "error"
      );

      return;
    }

    showNotice(
      "Canción guardada.",
      "success"
    );


    await loadSongs();


    const updatedSong =
      allSongs.find(
        song =>
          song.id ===
          currentSong.id
      );


    if (updatedSong) {

      currentSong =
        updatedSong;

      loadComparison(
        updatedSong
      );

    }

  }
);


/* ============================================================
   COMPARACIÓN CON ORIGINAL
============================================================ */

function loadComparison(
  song
) {

  document.getElementById(
    "originalBpm"
  ).value =
    song.original_bpm ?? "";


  document.getElementById(
    "originalKey"
  ).value =
    song.original_key || "";


  document.getElementById(
    "originalDuration"
  ).value =
    formatDuration(
      song.original_duration
    );


  document.getElementById(
    "originalMeter"
  ).value =
    song.original_meter || "";

}


async function loadOriginalComparisonMaterial() {

  if (!currentSong) {
    return;
  }

  try {

    const {
      data: materials,
      error
    } =
      await getMaterialsBySongId(
        supabaseClient,
        currentSong.id
      );

    if (error) {
      throw error;
    }

    const material =
      (materials || []).find(
        item =>
          item.type === COMPARISON_MATERIAL_TYPE
      ) || null;

    currentOriginalComparisonMaterial =
      material;

    if (!material) {

      openCommentComposer(
        "comparison",
        [],
        []
      );

      return;

    }

    const [
      attachmentsResult,
      blocksResult
    ] = await Promise.all([
      getMaterialAttachments(
        supabaseClient,
        [material.id]
      ),
      getMaterialBlocksByMaterialIds(
        supabaseClient,
        [material.id]
      )
    ]);

    if (
      attachmentsResult.error ||
      blocksResult.error
    ) {
      throw (
        attachmentsResult.error ||
        blocksResult.error
      );
    }

    const attachments =
      attachmentsResult.data || [];

    const dbBlocks =
      (blocksResult.data || [])
        .filter(
          block =>
            block.material_id ===
            material.id
        )
        .map(
          block => ({
            ...block,
            attachment:
              block.attachment_id
                ? attachments.find(
                    item =>
                      item.id ===
                      block.attachment_id
                  ) || null
                : null
          })
        );

    const blocks =
      dbBlocks.length
        ? dbBlocks.map(
            block =>
              block.block_type ===
                "text"
                ? {
                    block_type:
                      "text",
                    content:
                      block.content || ""
                  }
                : {
                    block_type:
                      "attachment",
                    attachment_id:
                      block.attachment_id,
                    attachment:
                      block.attachment
                  }
          )
        : [
            {
              block_type:
                "text",
              content:
                material.content || ""
            }
          ];

    currentOriginalComparisonMaterial = {
      ...material,
      attachments,
      blocks
    };

    openCommentComposer(
      "comparison",
      blocks,
      attachments
    );

  } catch (error) {

    console.error(
      "No se pudo cargar la comparación con la original.",
      error
    );

  }
}


async function saveOriginalComparison() {

  if (
    !currentBand ||
    !currentSong ||
    !currentUser
  ) {
    return;
  }

  const state =
    getCommentState("comparison");

  const blocks =
    collectCommentComposerBlocks(
      "comparison"
    );

  const text =
    getCommentText(blocks);

  const hasAttachment =
    blocks.some(
      block =>
        block.block_type ===
        "attachment"
    );

  if (!text && !hasAttachment) {
    showNotice(
      "La comparación no puede estar vacía.",
      "error"
    );
    return;
  }

  if (text.length > 5000) {
    showNotice(
      "El texto de la comparación no puede superar los 5000 caracteres.",
      "error"
    );
    return;
  }

  let materialId =
    currentOriginalComparisonMaterial?.id ||
    null;

  if (materialId) {

    const {
      error
    } = await updateMaterial(
      supabaseClient,
      materialId,
      {
        name:
          "Diferencias con la original",
        content:
          text
      }
    );

    if (error) {
      showNotice(
        error.message,
        "error"
      );
      return;
    }

  } else {

    const {
      data: material,
      error
    } = await supabaseClient
      .from("materials")
      .insert({
        band_id:
          currentBand.id,
        song_id:
          currentSong.id,
        type:
          COMPARISON_MATERIAL_TYPE,
        name:
          "Diferencias con la original",
        content:
          text,
        created_by:
          currentUser.id
      })
      .select(MATERIAL_COLUMNS)
      .single();

    if (error) {
      showNotice(
        error.message,
        "error"
      );
      return;
    }

    materialId =
      material.id;
  }

  const persistedBlocks = [];

  for (const block of blocks) {

    if (block.block_type === "text") {

      persistedBlocks.push({
        block_type:
          "text",
        content:
          block.content || "",
        attachment_id:
          null
      });

      continue;
    }

    if (
      block.block_type !==
      "attachment"
    ) {
      continue;
    }

    if (block.attachment_id) {

      persistedBlocks.push({
        block_type:
          "attachment",
        content:
          null,
        attachment_id:
          block.attachment_id
      });

      continue;
    }

    const pending =
      state.pendingAttachments[
        block.pendingKey
      ];

    if (!pending) {
      continue;
    }

    if (pending.kind === "link") {

      const {
        data: attachment,
        error
      } = await createMaterialAttachment(
        supabaseClient,
        {
          material_id:
            materialId,
          kind:
            "link",
          name:
            pending.name,
          url:
            pending.url,
          storage_path:
            null,
          mime_type:
            null,
          created_by:
            currentUser.id
        }
      );

      if (error) {
        showNotice(
          "La comparación se guardó, pero no se pudo registrar el enlace: " +
            error.message,
          "error"
        );
        return;
      }

      persistedBlocks.push({
        block_type:
          "attachment",
        content:
          null,
        attachment_id:
          attachment.id
      });

      continue;
    }

    const file =
      pending.file;

    if (!file) {
      continue;
    }

    const storagePath =
      currentBand.id +
      "/" +
      materialId +
      "/comparison/" +
      crypto.randomUUID() +
      "-" +
      sanitizeStorageFileName(
        file.name
      );

    const {
      error: uploadError
    } = await supabaseClient
      .storage
      .from("materials")
      .upload(
        storagePath,
        file,
        {
          upsert:
            false,
          contentType:
            file.type ||
            undefined
        }
      );

    if (uploadError) {
      showNotice(
        "La comparación se guardó, pero no se pudo subir el archivo: " +
          file.name +
          ". " +
          uploadError.message,
        "error"
      );
      return;
    }

    const {
      data: attachment,
      error
    } = await createMaterialAttachment(
      supabaseClient,
      {
        material_id:
          materialId,
        kind:
          "file",
        name:
          file.name,
        url:
          null,
        storage_path:
          storagePath,
        mime_type:
          file.type ||
          null,
        created_by:
          currentUser.id
      }
    );

    if (error) {

      await supabaseClient
        .storage
        .from("materials")
        .remove([
          storagePath
        ]);

      showNotice(
        "El archivo se subió, pero no se pudo registrar: " +
          error.message,
        "error"
      );
      return;
    }

    persistedBlocks.push({
      block_type:
        "attachment",
      content:
        null,
      attachment_id:
        attachment.id
    });
  }

  const {
    error: blocksError
  } = await replaceMaterialBlocks(
    supabaseClient,
    materialId,
    persistedBlocks.map(
      (block, index) => ({
        material_id:
          materialId,
        block_type:
          block.block_type,
        content:
          block.content,
        attachment_id:
          block.attachment_id,
        position:
          index
      })
    )
  );

  if (blocksError) {
    showNotice(
      "La comparación se guardó, pero no se pudo guardar el orden de su contenido: " +
        blocksError.message,
      "error"
    );
    return;
  }

  const keptIds =
    new Set(
      persistedBlocks
        .filter(
          block =>
            block.block_type ===
              "attachment" &&
            block.attachment_id
        )
        .map(
          block =>
            block.attachment_id
        )
    );

  const removedIds =
    [...state.originalAttachmentIds]
      .filter(
        id =>
          !keptIds.has(id)
      );

  if (removedIds.length) {

    const removedAttachments =
      (
        currentOriginalComparisonMaterial?.attachments || []
      ).filter(
        attachment =>
          removedIds.includes(
            attachment.id
          )
      );

    const storagePaths =
      removedAttachments
        .filter(
          attachment =>
            attachment.kind ===
              "file" &&
            attachment.storage_path
        )
        .map(
          attachment =>
            attachment.storage_path
        );

    if (storagePaths.length) {
      await supabaseClient
        .storage
        .from("materials")
        .remove(
          storagePaths
        );
    }

    for (const attachmentId of removedIds) {
      await deleteMaterialAttachment(
        supabaseClient,
        attachmentId
      );
    }
  }

  showNotice(
    "Comparación guardada.",
    "success"
  );

  await loadOriginalComparisonMaterial();
}


document.getElementById(
  "toggleComparisonBtn"
).addEventListener(
  "click",
  function() {

    const comparison =
      document.getElementById(
        "comparisonSection"
      );

    const hidden =
      comparison.classList.contains(
        "hidden"
      );


    if (hidden) {

      comparison.classList.remove(
        "hidden"
      );

      this.textContent =
        "Ocultar comparación";

    } else {

      comparison.classList.add(
        "hidden"
      );

      this.textContent =
        "Comparar con original";

    }

  }
);


document.getElementById(
  "originalComparisonForm"
).addEventListener(
  "submit",
  async function(event) {
    event.preventDefault();
    await saveOriginalComparison();
  }
);


/* ============================================================
   VOLVER A CANCIONES
============================================================ */

document.getElementById(
  "backToSongsBtn"
).addEventListener(
  "click",
  function() {

    currentSong =
      null;

    currentMaterials = [];

    currentComments = [];

    resetCommentForm();

    resetCommentComposer("comparison");
    currentOriginalComparisonMaterial = null;

    hideMaterialForm();

    document.getElementById(
      "songDetail"
    ).classList.add(
      "hidden"
    );

    document.getElementById(
      "songsBrowser"
    ).classList.remove(
      "hidden"
    );

    renderSongs();

  }
);
