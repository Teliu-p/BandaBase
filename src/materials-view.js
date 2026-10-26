/* ============================================================
   MATERIALES
============================================================ */

let editingMaterialId = null;
let openMaterialIds = new Set();
let materialDraftInitialAttachmentIds = new Set();
let materialSelectionRange = null;
let materialPendingAttachments = {};
let materialAudioMarkerStateSongId = null;
let materialAudioMarkerTimeSeconds = null;
let materialAudioMarkerSelectionVersion = 0;
// Audio engines created on demand for attachments in currently folded Materials.
let materialAudioSeekEnginePool = new Map();
let materialAudioPlaybackRates = new Map();
const MATERIAL_AUDIO_SPEED_PRESETS = Object.freeze([25, 50, 75, 100, 125, 150, 175, 200]);
const COMPARISON_MATERIAL_TYPE = "ComparacionOriginal";


function getSafeMaterialUrl(value) {

  const url = String(value || "").trim();

  if (!url) {
    return null;
  }

  try {

    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return parsed.href;

  } catch (error) {

    return null;

  }

}


function sanitizeStorageFileName(fileName) {

  return String(fileName || "archivo")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "archivo";

}


function getMaterialAttachmentIcon(
  attachment
) {

  if (
    attachment?.kind ===
    "link"
  ) {
    return "↗";
  }

  const mime =
    String(
      attachment?.mime_type || ""
    ).toLowerCase();

  if (
    mime.startsWith(
      "audio/"
    )
  ) {
    return "♫";
  }

  if (
    mime.includes(
      "pdf"
    )
  ) {
    return "PDF";
  }

  if (
    mime.includes(
      "image/"
    )
  ) {
    return "IMG";
  }

  if (
    mime.includes(
      "video/"
    )
  ) {
    return "VID";
  }

  if (
    mime.includes(
      "word"
    ) ||
    mime.includes(
      "document"
    )
  ) {
    return "DOC";
  }

  if (
    mime.includes(
      "sheet"
    ) ||
    mime.includes(
      "excel"
    )
  ) {
    return "XLS";
  }

  if (
    mime.includes(
      "presentation"
    ) ||
    mime.includes(
      "powerpoint"
    )
  ) {
    return "PPT";
  }

  return "FILE";

}


function getAttachmentLabel(
  attachment
) {

  if (
    attachment?.kind ===
    "link"
  ) {
    return "Enlace web";
  }

  const mime =
    String(
      attachment?.mime_type || ""
    ).toLowerCase();

  if (
    mime.startsWith(
      "audio/"
    )
  ) {
    return "Audio";
  }

  if (
    mime.includes(
      "pdf"
    )
  ) {
    return "PDF";
  }

  if (
    mime.includes(
      "image/"
    )
  ) {
    return "Imagen";
  }

  if (
    mime.includes(
      "video/"
    )
  ) {
    return "Video";
  }

  return "Archivo";

}


function getMaterialAttachmentSecondaryText(
  attachment
) {

  if (
    attachment?.kind ===
    "link"
  ) {

    try {

      return new URL(
        attachment.url
      ).hostname.replace(
        /^www\./,
        ""
      );

    } catch (error) {

      return "Enlace web";

    }

  }

  return getAttachmentLabel(
    attachment
  );

}


function getAttachmentLabel(
  attachment
) {

  if (attachment?.kind === "link") {
    return "Enlace";
  }

  return attachment?.mime_type ||
    "Archivo";

}


async function loadMaterials() {

  const materialsList =
    document.getElementById(
      "materialsList"
    );

  if (!currentSong) {
    return;
  }

  const songId = String(currentSong.id || "");
  if (materialAudioMarkerStateSongId !== songId) {
    materialAudioMarkerStateSongId = songId;
    materialAudioMarkerTimeSeconds = null;
    materialAudioMarkerSelectionVersion += 1;
    clearMaterialAudioGroupSelection();
    disposeMaterialAudioSeekEnginePool();
  }

  materialsList.innerHTML =
    "Cargando...";

  const {
    data: materials,
    error
  } =
    await getMaterialsBySongId(
      supabaseClient,
      songId
    );

  if (String(currentSong?.id || "") !== songId) return;

  if (error) {

    showNotice(
      error.message,
      "error"
    );

    return;

  }

  const materialRows =
    (materials || []).filter(
      material =>
        material.type !== COMPARISON_MATERIAL_TYPE
    );

  const materialIds =
    materialRows.map(
      material =>
        material.id
    );

  const {
    data: attachmentRows,
    error: attachmentError
  } =
    await getMaterialAttachments(
      supabaseClient,
      materialIds
    );

  if (String(currentSong?.id || "") !== songId) return;

  if (attachmentError) {

    showNotice(
      attachmentError.message,
      "error"
    );

    return;

  }

  const attachmentsById =
    Object.fromEntries(
      (attachmentRows || []).map(
        attachment => [
          attachment.id,
          attachment
        ]
      )
    );

  const {
    data: blockRows,
    error: blockError
  } =
    await getMaterialBlocksByMaterialIds(
      supabaseClient,
      materialIds
    );

  if (String(currentSong?.id || "") !== songId) return;

  if (blockError) {

    showNotice(
      blockError.message,
      "error"
    );

    return;

  }

  const blocksByMaterial = {};

  (blockRows || []).forEach(
    block => {

      if (
        !blocksByMaterial[
          block.material_id
        ]
      ) {

        blocksByMaterial[
          block.material_id
        ] = [];

      }

      blocksByMaterial[
        block.material_id
      ].push({
        ...block,
        attachment:
          block.attachment_id
            ? attachmentsById[
                block.attachment_id
              ] || null
            : null
      });

    }
  );

  currentMaterials =
    materialRows.map(
      material => {

        const dbBlocks =
          blocksByMaterial[
            material.id
          ] || [];

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
                          block.content ||
                          ""
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
                    material.content ||
                    ""
                }
              ];

        return {
          ...material,
          attachments:
            (attachmentRows || []).filter(
              attachment =>
                attachment.material_id ===
                material.id
            ),
          blocks
        };

      }
    );

  openMaterialIds =
    new Set(
      [...openMaterialIds].filter(
        id =>
          materialIds.includes(
            id
          )
      )
    );

  renderMaterials();

}


function formatMaterialAudioTime(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return "00:00";

  const totalSeconds = Math.floor(numeric);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = number => String(number).padStart(2, "0");

  return hours
    ? hours + ":" + pad(minutes) + ":" + pad(seconds)
    : String(minutes).padStart(2, "0") + ":" + pad(seconds);
}


function getMaterialAudioPlaybackRate(percentage) {
  const numeric = Number(percentage);
  if (!Number.isFinite(numeric) || numeric < 25 || numeric > 200) return null;
  return numeric / 100;
}


function setMaterialAudioPlaybackRate(player, percentage) {
  const rate = getMaterialAudioPlaybackRate(percentage);
  if (!player || rate === null) return false;

  // Preserve pitch where the browser exposes standard or legacy-prefixed controls.
  ["preservesPitch", "mozPreservesPitch", "webkitPreservesPitch"].forEach(property => {
    try {
      player[property] = true;
    } catch {
      // The browser may expose a read-only compatibility alias.
    }
  });

  try {
    player.playbackRate = rate;
    return Number.isFinite(Number(player.playbackRate)) &&
      Math.abs(Number(player.playbackRate) - rate) < 0.001;
  } catch {
    return false;
  }
}


function seekMaterialAudioPlayerToTime(player, seconds) {
  const target = Number(seconds);
  if (!player || !Number.isSafeInteger(target) || target < 0 || target > 86400) return false;

  if (player.readyState < 1 || !Number.isFinite(player.duration) || player.duration <= 0) {
    player.dataset.materialAudioPendingSeek = String(target);
    return false;
  }

  try {
    player.currentTime = Math.min(target, player.duration);
    delete player.dataset.materialAudioPendingSeek;
    return true;
  } catch {
    player.dataset.materialAudioPendingSeek = String(target);
    return false;
  }
}


function waitForMaterialAudioMetadata(player) {
  if (player.readyState >= 1 && Number.isFinite(player.duration) && player.duration > 0) {
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    let settled = false;
    let timeoutId = null;
    const cleanup = () => {
      player.removeEventListener("loadedmetadata", onLoaded);
      player.removeEventListener("error", onError);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    const finish = ready => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ready);
    };
    const onLoaded = () => finish(
      Number.isFinite(player.duration) && player.duration > 0
    );
    const onError = () => finish(false);

    player.addEventListener("loadedmetadata", onLoaded);
    player.addEventListener("error", onError);
    timeoutId = window.setTimeout(() => finish(false), 10000);

    if (player.readyState >= 1 && Number.isFinite(player.duration) && player.duration > 0) {
      finish(true);
    }
  });
}


function disposeMaterialAudioSeekEnginePool() {
  for (const player of materialAudioSeekEnginePool.values()) {
    try {
      player.pause();
      player.removeAttribute("src");
      player.load();
    } catch {
      // Releasing a temporary media engine must not block song navigation.
    }
    player.remove();
  }
  materialAudioSeekEnginePool.clear();
}


function getMaterialAudioAttachmentsForCurrentSong() {
  return getAllCurrentMaterialAttachments().filter(attachment =>
    attachment.kind === "file" &&
    String(attachment.mime_type || "").toLowerCase().startsWith("audio/") &&
    attachment.storage_path
  );
}


function getMaterialAudioPlayerForMarker(attachment, visiblePlayers) {
  const attachmentId = String(attachment.id);
  const visiblePlayer = visiblePlayers.find(player =>
    String(player.closest("[data-material-audio-id]")?.dataset.materialAudioId || "") === attachmentId
  );

  if (visiblePlayer) {
    const pooledPlayer = materialAudioSeekEnginePool.get(attachmentId);
    if (pooledPlayer) {
      try {
        pooledPlayer.pause();
        pooledPlayer.removeAttribute("src");
        pooledPlayer.load();
      } catch {
        // Ignore cleanup errors for an already-positioned temporary engine.
      }
      pooledPlayer.remove();
      materialAudioSeekEnginePool.delete(attachmentId);
    }

    return { player: visiblePlayer, isTemporary: false };
  }

  let player = materialAudioSeekEnginePool.get(attachmentId);
  if (!player || !player.isConnected) {
    player = document.createElement("audio");
    player.className = "material-audio-engine";
    player.hidden = true;
    player.preload = "none";
    player.dataset.materialAudio = attachment.storage_path;
    document.body.appendChild(player);
    materialAudioSeekEnginePool.set(attachmentId, player);
  }

  player.dataset.materialAudio = attachment.storage_path;
  return { player, isTemporary: true };
}


async function ensureMaterialAudioSourceForMarker(player, attachment) {
  const storagePath = attachment.storage_path || player.dataset.materialAudio;
  if (!storagePath) return false;

  const expiresAt = Number(player.dataset.materialAudioUrlExpiresAt || 0);
  if (player.src && expiresAt > Date.now() + 15000) return true;

  try {
    const response = await supabaseClient
      .storage
      .from("materials")
      .createSignedUrl(storagePath, 3600);
    const signedUrl = response.data?.signedUrl || null;

    if (response.error || !signedUrl) return false;

    player.src = signedUrl;
    player.dataset.materialAudioUrlExpiresAt = String(Date.now() + 55 * 60 * 1000);
    player.preload = "metadata";
    player.load();
    return true;
  } catch {
    delete player.dataset.materialAudioUrlExpiresAt;
    return false;
  }
}


async function selectMaterialAudioMarker(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86400) return;

  const selectionVersion = ++materialAudioMarkerSelectionVersion;
  materialAudioMarkerTimeSeconds = seconds;
  const materialsList = document.getElementById("materialsList");
  if (!materialsList) return;

  materialsList.querySelectorAll("[data-material-audio-marker]").forEach(button => {
    const active = Number(button.dataset.materialAudioMarkerSeconds) === seconds;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });

  // Update any in-flight player load immediately, so an older loadedmetadata
  // event cannot briefly apply a previously selected timestamp.
  materialsList.querySelectorAll("[data-material-audio]").forEach(player => {
    player.dataset.materialAudioPendingSeek = String(seconds);
  });

  // Include audio attachments from every Material, even if its card is folded.
  // Metadata is fetched only in direct response to clicking a timestamp marker.
  const attachments = getMaterialAudioAttachmentsForCurrentSong();
  if (!attachments.length) return;

  const visiblePlayers = Array.from(
    materialsList.querySelectorAll("[data-material-audio]")
  );

  const results = await Promise.all(attachments.map(async attachment => {
    const { player, isTemporary } = getMaterialAudioPlayerForMarker(attachment, visiblePlayers);
    const wasPlaying = !player.paused && !player.ended;

    const sourceReady = await ensureMaterialAudioSourceForMarker(player, attachment);
    if (selectionVersion !== materialAudioMarkerSelectionVersion) return null;
    if (!sourceReady) return false;

    const metadataReady = await waitForMaterialAudioMetadata(player);
    if (selectionVersion !== materialAudioMarkerSelectionVersion) return null;
    if (!metadataReady) return false;

    const positioned = seekMaterialAudioPlayerToTime(player, seconds);
    if (positioned && wasPlaying && player.paused) {
      // Refreshing an expired signed URL can pause an active player; preserve
      // its prior play state, but never start a previously paused track.
      try {
        await player.play();
      } catch {
        // The position is still set; keep other audio markers usable.
      }
    }

    if (isTemporary && !positioned) {
      player.dataset.materialAudioPendingSeek = String(seconds);
    }
    return positioned;
  }));

  if (selectionVersion !== materialAudioMarkerSelectionVersion) return;

  const failed = results.filter(result => result === false).length;
  if (failed > 0) {
    const succeeded = results.filter(result => result === true).length;
    showNotice(
      succeeded
        ? "El marcador se posicionó en " + succeeded + " de " + attachments.length + " audios; algunos no pudieron cargarse."
        : "No se pudo posicionar el marcador en los audios. Comprobá la conexión e intentá nuevamente.",
      "error"
    );
  }
}


function closeMaterialAudioPopover(panel) {
  if (!panel) return;
  panel.hidden = true;
  panel.removeAttribute("data-material-audio-portal");
  panel.remove();
  panel.style.left = "";
  panel.style.top = "";
  panel.style.width = "";
  panel._materialAudioOwnerButton?.setAttribute("aria-expanded", "false");
  panel._materialAudioOwnerButton = null;
}


function closeMaterialAudioPopovers(exceptPanel = null) {
  document.querySelectorAll("[data-material-audio-portal='true']").forEach(panel => {
    if (panel !== exceptPanel) closeMaterialAudioPopover(panel);
  });
}


let materialAudioPopoverDismissalBound = false;
let materialAudioGroupSelectedIds = new Set();

function getAllCurrentMaterialAttachments() {
  const materials = [
    ...(currentMaterials || []),
    ...(currentOriginalComparisonMaterial ? [currentOriginalComparisonMaterial] : [])
  ];
  const attachments = new Map();

  materials.forEach(material => {
    (material.attachments || []).forEach(attachment => {
      if (attachment?.id) attachments.set(String(attachment.id), attachment);
    });
  });

  return Array.from(attachments.values());
}

function clearMaterialAudioGroupSelection() {
  materialAudioGroupSelectedIds.clear();
  document.querySelectorAll("[data-material-audio-group-badge]").forEach(badge => {
    badge.hidden = true;
  });
  document.querySelectorAll("[data-material-inline-audio]").forEach(wrapper => {
    wrapper.classList.remove("is-group-selected");
  });
}

function updateMaterialAudioGroupSelectionUi(root = document) {
  const count = materialAudioGroupSelectedIds.size;
  root.querySelectorAll("[data-material-inline-audio]").forEach(wrapper => {
    const id = String(wrapper.dataset.materialAudioId || "");
    const selected = Boolean(id && materialAudioGroupSelectedIds.has(id));
    wrapper.classList.toggle("is-group-selected", selected);
    wrapper.title = selected
      ? "Pista seleccionada para reproducción en grupo. Clic derecho para quitarla."
      : "Clic derecho para seleccionar esta pista y reproducir varias a la vez.";
    const badge = wrapper.querySelector("[data-material-audio-group-badge]");
    if (badge) {
      badge.hidden = !selected;
      badge.textContent = selected ? "Grupo " + count : "";
    }
  });
}

async function toggleMaterialAudioGroupPlayback(clickedWrapper) {
  const selectedIds = [...materialAudioGroupSelectedIds];
  if (selectedIds.length < 2) return false;

  const visibleWrappers = Array.from(
    document.querySelectorAll("[data-material-inline-audio]")
  );
  const wrappers = selectedIds.map(id =>
    visibleWrappers.find(wrapper => String(wrapper.dataset.materialAudioId || "") === id)
  );

  if (wrappers.some(wrapper => !wrapper)) {
    showNotice(
      "Abrí los materiales que contienen todas las pistas seleccionadas para poder iniciarlas juntas.",
      "error"
    );
    return true;
  }

  const controls = wrappers.map(wrapper => wrapper.__materialAudioControls || null);
  if (controls.some(control => !control?.player || typeof control.ensureAudioUrl !== "function")) {
    showNotice("No se pudieron preparar todas las pistas seleccionadas. Volvé a abrir Materiales e intentá de nuevo.", "error");
    return true;
  }

  const players = controls.map(control => control.player);
  const selectedPlayerSet = new Set(players);
  const isPlaying = players.some(player => !player.paused && !player.ended);
  window.bandabaseMaterialAudioGroupTransitionInProgress = true;

  try {
    if (isPlaying) {
      players.forEach(player => player.pause());
      return true;
    }

    // Do not leave an unrelated track playing under a newly launched split group.
    document.querySelectorAll("[data-material-inline-audio] audio[data-material-audio]").forEach(player => {
      if (!selectedPlayerSet.has(player) && !player.paused && !player.ended) player.pause();
    });

    const loaded = await Promise.all(controls.map(control => control.ensureAudioUrl()));
    if (loaded.some(value => !value)) {
      throw new Error("No se pudieron cargar todas las pistas del grupo.");
    }

    const metadataReady = await Promise.all(players.map(waitForMaterialAudioMetadata));
    if (metadataReady.some(value => !value)) {
      throw new Error("No se pudo leer la duración de todas las pistas seleccionadas.");
    }

    const clickedControl =
      controls.find(control => control.wrapper === clickedWrapper) ||
      controls[0];
    const clickedPlayer = clickedControl.player;
    const duration = Number.isFinite(clickedPlayer.duration) ? clickedPlayer.duration : 0;
    let startSeconds = Number(clickedPlayer.currentTime) || 0;
    if (
      clickedPlayer.ended ||
      (duration > 0 && startSeconds >= duration - 0.05)
    ) {
      startSeconds = 0;
    }

    const playbackRate = Number(clickedPlayer.playbackRate) || 1;
    const playbackPercent = playbackRate * 100;

    players.forEach(player => {
      delete player.dataset.materialAudioPendingSeek;
      setMaterialAudioPlaybackRate(player, playbackPercent);
      materialAudioPlaybackRates.set(
        String(player.closest("[data-material-audio-id]")?.dataset.materialAudioId || ""),
        playbackPercent
      );
      seekMaterialAudioPlayerToTime(player, startSeconds);
    });

    await Promise.all(players.map(player => player.play()));
  } catch (error) {
    players.forEach(player => {
      if (!player.paused) player.pause();
    });
    showNotice(
      error?.message || "No se pudieron iniciar las pistas al mismo tiempo.",
      "error"
    );
  } finally {
    window.bandabaseMaterialAudioGroupTransitionInProgress = false;
    controls.forEach(control => control.updateAudioUi?.());
    if (typeof window.bandabaseSyncMetronomeWithAudio === "function") {
      window.bandabaseSyncMetronomeWithAudio();
    }
  }

  return true;
}

function bindMaterialAudioPopoverDismissal() {
  if (materialAudioPopoverDismissalBound) return;
  materialAudioPopoverDismissalBound = true;

  document.addEventListener("pointerdown", event => {
    document.querySelectorAll("[data-material-audio-portal='true']").forEach(panel => {
      const owner = panel._materialAudioOwnerWrapper;
      if (panel.contains(event.target) || owner?.contains(event.target)) return;
      closeMaterialAudioPopover(panel);
    });
  }, true);

  window.addEventListener("scroll", () => closeMaterialAudioPopovers(), true);
  window.addEventListener("resize", () => closeMaterialAudioPopovers());
}


function renderMaterialViewBlock(block) {
  if (block.block_type === "text") {
    const richText = renderMaterialRichTextHtml(block.content || "");
    return (
      '<span class="material-view-text material-rich-text">' +
      (
        richText !== null
          ? richText
          : block.content
            ? renderMaterialAutoLinkedTextHtml(block.content)
            : ""
      ) +
      "</span>"
    );
  }

  const attachment = block.attachment;
  if (!attachment) return "";

  const icon = getMaterialAttachmentIcon(attachment);
  const name = attachment.name || (attachment.kind === "link" ? "Enlace" : "Archivo");
  const attachmentId = escapeHtml(attachment.id || "");
  const safeName = escapeHtml(name);

  if (
    attachment.kind === "file" &&
    String(attachment.mime_type || "").startsWith("audio/")
  ) {
    const label = escapeHtml(name);
    return (
      '<span class="material-inline-audio" data-material-inline-audio data-material-audio-id="' + attachmentId + '">' +
        '<button type="button" class="material-inline-audio-play" data-material-audio-play aria-label="Reproducir ' + safeName + '" title="Reproducir audio">▶</button>' +
        '<button type="button" class="material-inline-audio-name" data-material-audio-details aria-expanded="false" title="Mostrar tiempo, posición y velocidad">' +
          label +
        '</button>' +
        '<button type="button" class="material-inline-audio-download" data-download-attachment="' + attachmentId + '" aria-label="Descargar ' + safeName + '" title="Descargar archivo">↓</button>' +
        '<span class="material-inline-audio-panel" data-material-audio-panel hidden>' +
          '<span class="material-inline-audio-time" data-material-audio-time>00:00 / --:--</span>' +
          '<input type="range" class="material-inline-audio-seek" data-material-audio-seek min="0" max="1000" step="1" value="0" disabled aria-label="Posición del audio">' +
          '<label class="material-inline-audio-speed-label">Velocidad' +
            '<span class="material-inline-audio-speed-controls">' +
              '<select class="material-inline-audio-speed" data-material-audio-speed aria-label="Velocidad de reproducción">' +
                '<option value="25">25%</option>' +
                '<option value="50">50%</option>' +
                '<option value="75">75%</option>' +
                '<option value="100">100%</option>' +
                '<option value="125">125%</option>' +
                '<option value="150">150%</option>' +
                '<option value="175">175%</option>' +
                '<option value="200">200%</option>' +
                '<option value="custom">Personalizada</option>' +
              '</select>' +
              '<input type="number" class="material-inline-audio-speed-custom" data-material-audio-speed-custom min="25" max="200" step="any" value="100" aria-label="Velocidad personalizada en porcentaje">' +
            '</span>' +
          '</label>' +
          '<span class="material-inline-audio-pitch-note">La afinación se mantiene.</span>' +
        '</span>' +
        '<audio class="material-audio-engine" preload="none" data-material-audio="' +
          escapeHtml(attachment.storage_path || "") +
        '" hidden></audio>' +
      '</span>'
    );
  }

  const openLabel = attachment.kind === "link" ? "Abrir enlace" : "Abrir archivo";
  return (
    '<span class="material-inline-view-attachment" role="group">' +
      '<span class="material-inline-view-name" title="' + safeName + '">' +
        escapeHtml(icon + " " + name) +
      '</span>' +
      '<button type="button" class="material-inline-view-open" data-open-attachment="' + attachmentId + '" aria-label="' + escapeHtml(openLabel + ": " + name) + '" title="' + escapeHtml(openLabel) + '">↗</button>' +
      (attachment.kind === "file"
        ? '<button type="button" class="material-inline-view-download" data-download-attachment="' + attachmentId + '" aria-label="Descargar ' + safeName + '" title="Descargar archivo">↓</button>'
        : '') +
    '</span>'
  );
}


function renderMaterials() {

  closeMaterialAudioPopovers();

  const materialsList =
    document.getElementById(
      "materialsList"
    );

  if (!currentMaterials.length) {

    materialsList.innerHTML =
      '<div class="empty-state">' +
      'Todavía no hay materiales para esta canción.<br>' +
      'Usá <strong>+ Añadir material</strong> para crear el primero.' +
      '</div>';

    return;

  }

  materialsList.innerHTML =
    currentMaterials.map(
      material => {

        const isOpen =
          openMaterialIds.has(
            material.id
          );

        const blocks =
          material.blocks || [];

        const resourceCount =
          blocks.filter(
            block =>
              block.block_type ===
              "attachment"
          ).length;

        let html =
          '<article class="material-card">';

        html +=
          '<button type="button" class="material-header" data-material-toggle="' +
          escapeHtml(
            material.id
          ) +
          '" aria-expanded="' +
          (
            isOpen
              ? "true"
              : "false"
          ) +
          '">';

        html +=
          '<span class="material-header-main">' +
          '<span class="material-chevron">' +
          (
            isOpen
              ? "▾"
              : "▸"
          ) +
          '</span>' +
          '<span class="material-title">' +
          escapeHtml(
            material.name
          ) +
          '</span>' +
          '</span>';

        html +=
          '<span class="material-attachment-type">' +
          (
            resourceCount
              ? resourceCount +
                " recurso" +
                (
                  resourceCount === 1
                    ? ""
                    : "s"
                )
              : "Solo texto"
          ) +
          '</span>';

        html +=
          '</button>';

        if (isOpen) {

          html +=
            '<div class="material-body">' +
            '<div class="material-view">';

          blocks.forEach(
            block => {

              html +=
                renderMaterialViewBlock(
                  block
                );

            }
          );

          html +=
            '</div>' +
            '<div class="detail-actions" style="margin-top:14px;">' +
            '<button type="button" class="btn btn-subtle" data-edit-material="' +
            escapeHtml(
              material.id
            ) +
            '">Editar material</button>' +
            '<button type="button" class="btn btn-subtle btn-danger" data-delete-material="' +
            escapeHtml(
              material.id
            ) +
            '">Eliminar material</button>' +
            '</div>' +
            '</div>';

        }

        html +=
          '</article>';

        return html;

      }
    ).join("");

  bindMaterialViewEvents();

}


function bindMaterialViewEvents() {
  bindMaterialAudioPopoverDismissal();

  document.querySelectorAll("[data-material-inline-audio]").forEach(wrapper => {
    const player = wrapper.querySelector("[data-material-audio]");
    const playButton = wrapper.querySelector("[data-material-audio-play]");
    const detailsButton = wrapper.querySelector("[data-material-audio-details]");
    const panel = wrapper.querySelector("[data-material-audio-panel]");
    const timeLabel = wrapper.querySelector("[data-material-audio-time]");
    const seekInput = wrapper.querySelector("[data-material-audio-seek]");
    const speedSelect = wrapper.querySelector("[data-material-audio-speed]");
    const speedInput = wrapper.querySelector("[data-material-audio-speed-custom]");

    if (!player || !playButton || !detailsButton || !panel || !timeLabel || !seekInput || !speedSelect || !speedInput) return;

    const attachmentId = String(wrapper.dataset.materialAudioId || "");
    setMaterialAudioPlaybackRate(
      player,
      materialAudioPlaybackRates.get(attachmentId) ?? 100
    );
    const pooledPlayer = attachmentId
      ? materialAudioSeekEnginePool.get(attachmentId)
      : null;
    if (pooledPlayer) {
      try {
        pooledPlayer.pause();
        pooledPlayer.removeAttribute("src");
        pooledPlayer.load();
      } catch {
        // Ignore errors while replacing the temporary engine with the visible player.
      }
      pooledPlayer.remove();
      materialAudioSeekEnginePool.delete(attachmentId);
    }

    if (materialAudioMarkerTimeSeconds !== null && player.dataset.materialAudioPendingSeek === undefined) {
      player.dataset.materialAudioPendingSeek = String(materialAudioMarkerTimeSeconds);
    }

    function updateAudioUi() {
      const isPlaying = !player.paused && !player.ended;
      playButton.textContent = isPlaying ? "Ⅱ" : "▶";
      playButton.title = isPlaying ? "Pausar audio" : "Reproducir audio";
      playButton.setAttribute("aria-label", (isPlaying ? "Pausar " : "Reproducir ") + (wrapper.querySelector(".material-inline-audio-name")?.textContent || "audio"));

      const duration = Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : null;
      const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      timeLabel.textContent = formatMaterialAudioTime(currentTime) + " / " +
        (duration ? formatMaterialAudioTime(duration) : "--:--");

      seekInput.disabled = !duration;
      if (duration && document.activeElement !== seekInput) {
        seekInput.value = String(Math.max(0, Math.min(1000, Math.round(currentTime / duration * 1000))));
      }

      const speedPercentage = Math.round((Number(player.playbackRate) || 1) * 10000) / 100;
      if (document.activeElement !== speedInput) {
        speedInput.value = String(speedPercentage);
      }
      if (document.activeElement !== speedSelect) {
        const matchingPreset = MATERIAL_AUDIO_SPEED_PRESETS.find(
          preset => Math.abs(preset - speedPercentage) < 0.01
        );
        speedSelect.value = matchingPreset === undefined ? "custom" : String(matchingPreset);
      }
    }

    function applySpeedPercentage(value) {
      const percentage = Number(value);
      if (
        getMaterialAudioPlaybackRate(percentage) === null ||
        !setMaterialAudioPlaybackRate(player, percentage)
      ) {
        showNotice("Ingresá una velocidad entre 25% y 200%. La afinación se mantiene cuando el navegador admite el ajuste.", "error");
        speedInput.value = String(Math.round((Number(player.playbackRate) || 1) * 10000) / 100);
        updateAudioUi();
        return false;
      }

      materialAudioPlaybackRates.set(attachmentId, percentage);
      updateAudioUi();
      return true;
    }

    async function ensureAudioUrl() {
      const storagePath = player.dataset.materialAudio;
      if (!storagePath) {
        showNotice("No se encontró la ruta del audio guardado.", "error");
        return false;
      }

      const expiresAt = Number(player.dataset.materialAudioUrlExpiresAt || 0);
      if (player.src && expiresAt > Date.now() + 15000) {
        if (player.dataset.materialAudioPendingSeek !== undefined) {
          const metadataReady = await waitForMaterialAudioMetadata(player);
          if (!metadataReady) {
            showNotice("No se pudo ubicar el marcador en este audio. Probá de nuevo.", "error");
            return false;
          }

          // Read the current pending value after awaiting metadata: the user may
          // have chosen a different marker while the audio was becoming ready.
          const latestPendingSeek = player.dataset.materialAudioPendingSeek;
          if (latestPendingSeek !== undefined) {
            seekMaterialAudioPlayerToTime(player, Number(latestPendingSeek));
          }
        }
        return true;
      }

      try {
        const response = await supabaseClient
          .storage
          .from("materials")
          .createSignedUrl(storagePath, 3600);

        const signedUrl = response.data?.signedUrl || null;
        if (response.error || !signedUrl) {
          throw response.error || new Error("No se pudo obtener el audio.");
        }

        player.src = signedUrl;
        player.dataset.materialAudioUrlExpiresAt = String(Date.now() + 55 * 60 * 1000);
        // Obtener duración al abrir los detalles, sin precargar el audio completo.
        player.preload = "metadata";
        player.load();
        if (player.dataset.materialAudioPendingSeek !== undefined) {
          const metadataReady = await waitForMaterialAudioMetadata(player);
          if (!metadataReady) {
            showNotice("No se pudo ubicar el marcador en este audio. Probá de nuevo.", "error");
            return false;
          }

          const latestPendingSeek = player.dataset.materialAudioPendingSeek;
          if (latestPendingSeek !== undefined) {
            seekMaterialAudioPlayerToTime(player, Number(latestPendingSeek));
          }
        }
        updateAudioUi();
        return true;
      } catch (error) {
        delete player.dataset.materialAudioUrlExpiresAt;
        showNotice(error?.message || "No se pudo cargar el audio. Podés volver a intentarlo.", "error");
        return false;
      }
    }

    player.addEventListener("play", updateAudioUi);
    player.addEventListener("pause", updateAudioUi);
    player.addEventListener("ended", updateAudioUi);
    player.addEventListener("timeupdate", updateAudioUi);
    player.addEventListener("loadedmetadata", () => {
      setMaterialAudioPlaybackRate(
        player,
        materialAudioPlaybackRates.get(attachmentId) ?? 100
      );
      const pendingSeekValue = player.dataset.materialAudioPendingSeek;
      if (pendingSeekValue !== undefined) {
        seekMaterialAudioPlayerToTime(player, Number(pendingSeekValue));
      }
      updateAudioUi();
    });
    player.addEventListener("durationchange", updateAudioUi);
    player.addEventListener("seeked", updateAudioUi);
    player.addEventListener("ratechange", updateAudioUi);
    player.addEventListener("error", () => {
      delete player.dataset.materialAudioUrlExpiresAt;
      updateAudioUi();
    });

    seekInput.addEventListener("input", () => {
      const duration = Number.isFinite(player.duration) ? player.duration : 0;
      if (duration > 0) {
        player.currentTime = Math.max(0, Math.min(1000, Number(seekInput.value))) / 1000 * duration;
        updateAudioUi();
      }
    });

    speedSelect.addEventListener("change", () => {
      if (speedSelect.value === "custom") {
        speedInput.focus();
        speedInput.select();
        return;
      }
      applySpeedPercentage(speedSelect.value);
    });

    speedInput.addEventListener("change", () => {
      applySpeedPercentage(speedInput.value);
    });

    speedInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        speedInput.blur();
      }
    });

    playButton.addEventListener("click", async () => {
      if (playButton.disabled) return;

      if (!player.paused && !player.ended) {
        player.pause();
        updateAudioUi();
        return;
      }

      playButton.disabled = true;
      const loaded = await ensureAudioUrl();
      if (loaded) {
        try {
          await player.play();
        } catch (error) {
          showNotice(error?.message || "No se pudo reproducir el audio.", "error");
        }
      }
      playButton.disabled = false;
      updateAudioUi();
    });

    detailsButton.addEventListener("click", async () => {
      const isOpen = panel.dataset.materialAudioPortal === "true" && !panel.hidden;
      if (isOpen) {
        closeMaterialAudioPopover(panel);
        return;
      }

      closeMaterialAudioPopovers(panel);
      const bounds = detailsButton.getBoundingClientRect();
      const panelWidth = Math.min(280, Math.max(190, window.innerWidth - 24));
      const estimatedHeight = 150;
      const left = Math.max(12, Math.min(bounds.left, window.innerWidth - panelWidth - 12));
      let top = bounds.bottom + 6;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, bounds.top - estimatedHeight - 6);
      }

      panel.hidden = false;
      panel.dataset.materialAudioPortal = "true";
      panel._materialAudioOwnerButton = detailsButton;
      panel._materialAudioOwnerWrapper = wrapper;
      panel.style.position = "fixed";
      panel.style.zIndex = "10000";
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.width = panelWidth + "px";
      document.body.appendChild(panel);
      detailsButton.setAttribute("aria-expanded", "true");

      await ensureAudioUrl();
      updateAudioUi();
    });

    updateAudioUi();
  });

  document.querySelectorAll("#materialsList [data-material-audio-marker]").forEach(button => {
    button.addEventListener("click", () => {
      const seconds = Number(button.dataset.materialAudioMarkerSeconds);
      selectMaterialAudioMarker(seconds);
    });
  });

  if (materialAudioMarkerTimeSeconds !== null) {
    document.querySelectorAll("#materialsList [data-material-audio-marker]").forEach(button => {
      const active = Number(button.dataset.materialAudioMarkerSeconds) === materialAudioMarkerTimeSeconds;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
  }

    document
    .querySelectorAll(
      "[data-material-toggle]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          function() {

            const id =
              button.dataset.materialToggle;

            if (
              openMaterialIds.has(
                id
              )
            ) {

              openMaterialIds.delete(
                id
              );

            } else {

              openMaterialIds.add(
                id
              );

            }

            renderMaterials();

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-edit-material]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          function() {

            const material =
              currentMaterials.find(
                item =>
                  item.id ===
                  button.dataset.editMaterial
              );

            if (material) {

              openMaterialEditor(
                material
              );

            }

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-delete-material]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async function() {

            const material =
              currentMaterials.find(
                item =>
                  item.id ===
                  button.dataset.deleteMaterial
              );

            if (!material) {
              return;
            }

            const confirmed =
              window.confirm(
                "¿Eliminar \"" +
                material.name +
                "\" y todo lo que contiene?"
              );

            if (!confirmed) {
              return;
            }

            const storagePaths =
              (material.attachments || [])
                .filter(
                  attachment =>
                    attachment.kind === "file" &&
                    attachment.storage_path
                )
                .map(
                  attachment =>
                    attachment.storage_path
                );

            if (storagePaths.length) {

              const {
                error: storageError
              } =
                await supabaseClient
                  .storage
                  .from("materials")
                  .remove(
                    storagePaths
                  );

              if (storageError) {

                showNotice(
                  storageError.message,
                  "error"
                );

                return;

              }

            }

            const {
              error
            } =
              await deleteMaterial(
                supabaseClient,
                material.id
              );

            if (error) {

              showNotice(
                error.message,
                "error"
              );

              return;

            }

            openMaterialIds.delete(
              material.id
            );

            await loadMaterials();

          }
        );

      }
    );


  document
    .querySelectorAll(
      "[data-open-attachment]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async function() {

            const attachment =
              currentMaterials
                .flatMap(
                  material =>
                    material.attachments || []
                )
                .find(
                  item =>
                    item.id ===
                    button.dataset.openAttachment
                );

            if (!attachment) {
              return;
            }

            if (
              attachment.kind ===
              "link"
            ) {

              const url =
                getSafeMaterialUrl(
                  attachment.url
                );

              if (
                !url
              ) {

                showNotice(
                  "El enlace guardado no es válido.",
                  "error"
                );

                return;

              }

              window.open(
                url,
                "_blank",
                "noopener,noreferrer"
              );

              return;

            }

            const {
              data,
              error
            } =
              await supabaseClient
                .storage
                .from("materials")
                .createSignedUrl(
                  attachment.storage_path,
                  3600
                );

            if (error) {

              showNotice(
                error.message,
                "error"
              );

              return;

            }

            if (
              data?.signedUrl
            ) {

              window.open(
                data.signedUrl,
                "_blank",
                "noopener,noreferrer"
              );

            }

          }
        );

      }
    );

  document.querySelectorAll("[data-download-attachment]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.dataset.loading === "true") return;

      const attachment = currentMaterials
        .flatMap(material => material.attachments || [])
        .find(item => item.id === button.dataset.downloadAttachment);

      if (!attachment || attachment.kind !== "file" || !attachment.storage_path) {
        showNotice("No se encontró el archivo adjunto para descargar.", "error");
        return;
      }

      const downloadWindow = window.open("about:blank", "_blank");
      if (!downloadWindow) {
        showNotice("El navegador bloqueó la descarga. Permití las ventanas emergentes y probá de nuevo.", "error");
        return;
      }
      downloadWindow.opener = null;

      const previousText = button.textContent;
      button.dataset.loading = "true";
      button.disabled = true;
      button.textContent = "…";

      try {
        const { data, error } = await supabaseClient
          .storage
          .from("materials")
          .createSignedUrl(
            attachment.storage_path,
            3600,
            { download: attachment.name || attachment.file_name || true }
          );

        if (error || !data?.signedUrl) {
          throw new Error(error?.message || "No se pudo preparar la descarga.");
        }

        downloadWindow.location.href = data.signedUrl;
      } catch (error) {
        try { downloadWindow.close(); } catch {}
        showNotice(error?.message || "No se pudo descargar el archivo adjunto.", "error");
      } finally {
        button.dataset.loading = "false";
        button.disabled = false;
        button.textContent = previousText;
      }
    });
  });

}


