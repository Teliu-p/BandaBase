/* Actualizaciones en tiempo real para las vistas compartidas de la banda. */

const BANDABASE_REALTIME_TABLE_DOMAINS = Object.freeze({
  audit_log: "admin",
  band_list_items: "lists",
  band_list_managers: "lists",
  band_lists: "lists",
  band_members: "members",
  bands: "band",
  comment_attachments: "comments",
  comment_blocks: "comments",
  comments: "comments",
  material_attachments: "materials",
  material_blocks: "materials",
  materials: "materials",
  profiles: "members",
  proposal_attachments: "proposals",
  proposal_blocks: "proposals",
  proposal_options: "proposals",
  proposal_votes: "proposals",
  proposals: "proposals",
  song_singers: "songs",
  songs: "songs"
});

let bandabaseRealtimeChannel = null;
let bandabaseRealtimeBandId = null;
let bandabaseRealtimeFlushTimer = null;
let bandabaseRealtimeFlushRunning = false;
let bandabaseRealtimeConnectionWarningShown = false;
let bandabaseRealtimeDeferredWarningShown = false;
let bandabaseRealtimeSongDetailDirtyId = null;
let bandabaseRealtimePendingDomains = new Set();
let bandabaseRealtimePendingSongIds = new Set();

function isBandabaseFormVisible(id) {
  const form = document.getElementById(id);
  return Boolean(form && !form.classList.contains("hidden"));
}

function isBandabaseRealtimeDomainBusy(domain) {
  if (domain === "materials") {
    return isBandabaseFormVisible("materialForm");
  }

  if (domain === "proposals") {
    return isBandabaseFormVisible("proposalForm");
  }

  if (domain === "lists") {
    if (isBandabaseFormVisible("bandListForm")) return true;

    const detail = document.getElementById("listDetail");
    const active = document.activeElement;
    return Boolean(
      detail &&
      !detail.classList.contains("hidden") &&
      active &&
      detail.contains(active) &&
      active.matches?.("input, select, textarea, [contenteditable='true']")
    );
  }

  if (domain === "members") {
    return isBandabaseFormVisible("profileForm");
  }

  return false;
}

function showBandabaseRealtimeDeferredNotice() {
  if (bandabaseRealtimeDeferredWarningShown) return;

  bandabaseRealtimeDeferredWarningShown = true;
  showNotice(
    "Llegaron cambios desde otro dispositivo. Conservé abierto el editor para no pisar tu borrador; se actualizarán al cerrar o cancelar esa edición.",
    "success"
  );
}

function scheduleBandabaseRealtimeFlush(delay = 160) {
  if (bandabaseRealtimeFlushTimer !== null) {
    window.clearTimeout(bandabaseRealtimeFlushTimer);
  }

  bandabaseRealtimeFlushTimer = window.setTimeout(() => {
    bandabaseRealtimeFlushTimer = null;
    void flushBandabaseRealtimeRefreshes();
  }, delay);
}

function rememberBandabaseRealtimeChange(payload) {
  if (!currentUser?.id || !currentBand?.id || !payload) return;

  const domain = BANDABASE_REALTIME_TABLE_DOMAINS[payload.table];
  if (!domain) return;

  const newRow = payload.new || {};
  const oldRow = payload.old || {};
  const row = Object.keys(newRow).length ? newRow : oldRow;

  if (row.band_id && row.band_id !== currentBand.id) return;

  if (
    payload.table === "bands" &&
    row.id &&
    row.id !== currentBand.id
  ) {
    return;
  }

  bandabaseRealtimePendingDomains.add(domain);

  if (payload.table === "songs" && row.id) {
    bandabaseRealtimePendingSongIds.add(String(row.id));
  } else if (payload.table === "song_singers" && row.song_id) {
    bandabaseRealtimePendingSongIds.add(String(row.song_id));
  }

  scheduleBandabaseRealtimeFlush();
}

function syncSelectedSongAfterRealtime(changedSongIds) {
  if (!currentSong || !changedSongIds.has(String(currentSong.id))) return;

  const freshSong = (allSongs || []).find(song => String(song.id) === String(currentSong.id));

  if (!freshSong) {
    if (bandabaseRealtimeSongDetailDirtyId === String(currentSong.id)) {
      showNotice(
        "Esta canción se movió a la papelera desde otro dispositivo. Conservé tu edición abierta; volvé a Canciones antes de guardar para revisar el estado.",
        "error"
      );
      return;
    }

    currentSong = null;
    document.getElementById("songDetail")?.classList.add("hidden");
    document.getElementById("songsBrowser")?.classList.remove("hidden");
    showNotice("Esta canción ya no está disponible en el catálogo activo.", "success");
    return;
  }

  if (bandabaseRealtimeSongDetailDirtyId === String(freshSong.id)) {
    showNotice(
      "Esta canción cambió desde otro dispositivo. No reemplacé los campos que estás editando; volvé a abrirla para incorporar esos cambios antes de guardar.",
      "success"
    );
    return;
  }

  currentSong = freshSong;

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  };

  const title = document.getElementById("detailTitle");
  const subtitle = document.getElementById("detailSubtitle");
  if (title) title.textContent = freshSong.name || "Canción";
  if (subtitle) subtitle.textContent = freshSong.artist || "Artista no especificado";

  setValue("detailName", freshSong.name || "");
  setValue("detailArtist", freshSong.artist || "");
  setValue("detailGenre", Array.isArray(freshSong.genre) ? freshSong.genre.join(", ") : (freshSong.genre || ""));
  setValue("detailBpm", freshSong.bpm);
  setValue("detailDuration", formatDuration(freshSong.duration));
  setValue("detailMeter", freshSong.meter || "");
  setValue("detailListStatus", freshSong.status || "Pendiente");
  setValue("detailActiveStatus", freshSong.active_status || "Activa");

  const repertoire = document.getElementById("detailRepertoire");
  if (repertoire) {
    repertoire.checked = typeof getSongListCount === "function"
      ? getSongListCount(freshSong.id) > 0
      : Boolean(freshSong.in_repertoire);
  }

  selectedDetailSongColor = freshSong.color || null;
  const colorPicker = document.getElementById("detailColorPicker");
  if (colorPicker) {
    renderColorPicker(colorPicker, selectedDetailSongColor, color => {
      selectedDetailSongColor = color;
    });
  }

  const singers = document.getElementById("detailSingersContainer");
  if (singers && typeof renderDetailSingers === "function") {
    renderDetailSingers(singers, getSongSingers(freshSong), escapeHtml);
  }

  if (typeof window.bandabaseSyncMetronome === "function") {
    window.bandabaseSyncMetronome();
  }
  if (typeof loadComparison === "function") {
    void loadComparison(freshSong);
  }
}

async function refreshBandabaseRealtimeDomain(domain, changedSongIds) {
  if (!currentBand || !currentUser) return;

  if (domain === "songs") {
    await loadSongs();
    syncSelectedSongAfterRealtime(changedSongIds);
    return;
  }

  if (domain === "materials") {
    if (currentSong) await loadMaterials();
    return;
  }

  if (domain === "comments") {
    const tasks = [];
    if (currentSong) tasks.push(loadComments());
    tasks.push(loadGeneralComments());
    tasks.push(loadRecentGeneralComments());
    await Promise.all(tasks);
    return;
  }

  if (domain === "lists") {
    const result = await refreshBandListData();
    if (result?.error) throw result.error;

    renderBandLists();
    renderSongs();
    renderRecentListsPreview();

    if (currentBandList?.id) {
      const selected = currentBandLists.find(
        list => String(list.id) === String(currentBandList.id)
      );
      const detail = document.getElementById("listDetail");

      if (selected) {
        currentBandList = selected;
        if (detail && !detail.classList.contains("hidden")) {
          renderBandListDetailContent(selected, getBandListItems(selected.id));
        }
      } else {
        currentBandList = null;
        detail?.classList.add("hidden");
        document.getElementById("listsBrowser")?.classList.remove("hidden");
      }
    }
    return;
  }

  if (domain === "proposals") {
    await loadProposals();
    if (typeof loadRecentProposalsPreview === "function") {
      await loadRecentProposalsPreview();
    }
    return;
  }

  if (domain === "members") {
    await loadMembers();
    return;
  }

  if (domain === "band") {
    await loadCurrentBand();
    return;
  }

  if (domain === "admin") {
    if (
      !document.getElementById("section-administracion")?.classList.contains("hidden") &&
      window.bandabaseIsAdmin?.()
    ) {
      await loadAdminPanel();
    }
  }
}

async function flushBandabaseRealtimeRefreshes() {
  if (bandabaseRealtimeFlushRunning || !currentUser || !currentBand) return;

  const readyDomains = [...bandabaseRealtimePendingDomains].filter(
    domain => !isBandabaseRealtimeDomainBusy(domain)
  );

  if (!readyDomains.length) {
    if (bandabaseRealtimePendingDomains.size) {
      showBandabaseRealtimeDeferredNotice();
      // Keep checking the editor state without making network requests. This
      // handles drafts that become safe to refresh after their last input blurs.
      scheduleBandabaseRealtimeFlush(1000);
    }
    return;
  }

  readyDomains.forEach(domain => bandabaseRealtimePendingDomains.delete(domain));
  const changedSongIds = new Set(bandabaseRealtimePendingSongIds);
  bandabaseRealtimePendingSongIds.clear();
  const bandId = String(currentBand.id);

  bandabaseRealtimeFlushRunning = true;

  try {
    const results = await Promise.allSettled(
      readyDomains.map(domain => refreshBandabaseRealtimeDomain(domain, changedSongIds))
    );

    if (String(currentBand?.id || "") !== bandId) return;

    const failed = results.find(result => result.status === "rejected");
    if (failed) {
      console.error("No se pudieron aplicar todas las actualizaciones en tiempo real.", failed.reason);
      showNotice(
        "Llegó un cambio nuevo, pero no pude actualizar una de las vistas. La app seguirá escuchando; entrá de nuevo a esa sección para reintentar.",
        "error"
      );
    }
  } finally {
    bandabaseRealtimeFlushRunning = false;
    if (bandabaseRealtimePendingDomains.size) {
      scheduleBandabaseRealtimeFlush();
    } else {
      bandabaseRealtimeDeferredWarningShown = false;
    }
  }
}

function stopBandabaseRealtime() {
  if (bandabaseRealtimeFlushTimer !== null) {
    window.clearTimeout(bandabaseRealtimeFlushTimer);
    bandabaseRealtimeFlushTimer = null;
  }

  const channel = bandabaseRealtimeChannel;
  bandabaseRealtimeChannel = null;
  bandabaseRealtimeBandId = null;
  bandabaseRealtimePendingDomains.clear();
  bandabaseRealtimePendingSongIds.clear();
  bandabaseRealtimeSongDetailDirtyId = null;
  bandabaseRealtimeConnectionWarningShown = false;
  bandabaseRealtimeDeferredWarningShown = false;

  if (channel && typeof supabaseClient?.removeChannel === "function") {
    void supabaseClient.removeChannel(channel).catch(error => {
      console.warn("No se pudo cerrar el canal de actualizaciones de BandaBase.", error);
    });
  }
}

function startBandabaseRealtime() {
  if (!currentUser?.id || !currentBand?.id || typeof supabaseClient?.channel !== "function") {
    return;
  }

  const bandId = String(currentBand.id);
  if (bandabaseRealtimeChannel && bandabaseRealtimeBandId === bandId) return;

  stopBandabaseRealtime();
  bandabaseRealtimeBandId = bandId;

  const channel = supabaseClient
    .channel("bandabase-live-" + bandId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public" },
      payload => rememberBandabaseRealtimeChange(payload)
    )
    .subscribe(status => {
      if (bandabaseRealtimeChannel !== channel) return;

      if (status === "SUBSCRIBED") {
        bandabaseRealtimeConnectionWarningShown = false;

        // Reconcile the current snapshot after subscribe/reconnect. Realtime
        // events can be missed during a connection gap or subscription startup.
        [
          "songs",
          "lists",
          "proposals",
          "comments",
          "members",
          "band",
          "admin"
        ].forEach(domain => bandabaseRealtimePendingDomains.add(domain));

        if (currentSong?.id) {
          bandabaseRealtimePendingDomains.add("materials");
          bandabaseRealtimePendingSongIds.add(String(currentSong.id));
        }

        scheduleBandabaseRealtimeFlush();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn("Canal de actualizaciones en tiempo real:", status);
        if (!bandabaseRealtimeConnectionWarningShown) {
          bandabaseRealtimeConnectionWarningShown = true;
          showNotice(
            "Se interrumpió la conexión de actualizaciones en tiempo real. BandaBase intentará reconectarse; mientras tanto, los cambios pueden tardar en aparecer.",
            "error"
          );
        }
      }
    });

  bandabaseRealtimeChannel = channel;
}

function markBandabaseSongDetailDirty() {
  if (currentSong?.id) {
    bandabaseRealtimeSongDetailDirtyId = String(currentSong.id);
  }
}

function clearBandabaseSongDetailDirty() {
  bandabaseRealtimeSongDetailDirtyId = null;
}

window.bandabaseStartRealtime = startBandabaseRealtime;
window.bandabaseStopRealtime = stopBandabaseRealtime;
window.bandabaseFlushRealtimeRefreshes = flushBandabaseRealtimeRefreshes;
window.bandabaseClearSongDetailDirty = clearBandabaseSongDetailDirty;

document.getElementById("songDetailForm")?.addEventListener("input", markBandabaseSongDetailDirty);
document.getElementById("songDetailForm")?.addEventListener("change", markBandabaseSongDetailDirty);
