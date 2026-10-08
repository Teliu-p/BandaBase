/* Detalle y edición de canciones. */

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

  if (typeof window.bandabaseStopMetronome === "function") {
    window.bandabaseStopMetronome();
  }

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

  if (typeof window.bandabaseSyncMetronome === "function") {
    window.bandabaseSyncMetronome();
  }


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
   VOLVER A CANCIONES
============================================================ */

document.getElementById(
  "backToSongsBtn"
).addEventListener(
  "click",
  function() {

    if (typeof window.bandabaseStopMetronome === "function") {
      window.bandabaseStopMetronome();
    }

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
