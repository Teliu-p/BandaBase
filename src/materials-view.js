/* ============================================================
   MATERIALES
============================================================ */

let editingMaterialId = null;
let openMaterialIds = new Set();
let materialDraftInitialAttachmentIds = new Set();
let materialSelectionRange = null;
let materialPendingAttachments = {};
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

  materialsList.innerHTML =
    "Cargando...";

  const {
    data: materials,
    error
  } =
    await getMaterialsBySongId(
      supabaseClient,
      currentSong.id
    );

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
    : minutes + ":" + pad(seconds);
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
    const label = escapeHtml(icon + " " + name);
    return (
      '<span class="material-inline-audio" data-material-inline-audio data-material-audio-id="' + attachmentId + '">' +
        '<button type="button" class="material-inline-audio-play" data-material-audio-play aria-label="Reproducir ' + safeName + '" title="Reproducir audio">▶</button>' +
        '<button type="button" class="material-inline-audio-name" data-material-audio-details aria-expanded="false" title="Mostrar tiempo y posición">' +
          label +
        '</button>' +
        '<span class="material-inline-audio-panel" data-material-audio-panel hidden>' +
          '<span class="material-inline-audio-time" data-material-audio-time>00:00 / --:--</span>' +
          '<input type="range" class="material-inline-audio-seek" data-material-audio-seek min="0" max="1000" step="1" value="0" disabled aria-label="Posición del audio">' +
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

    if (!player || !playButton || !detailsButton || !panel || !timeLabel || !seekInput) return;

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
    }

    async function ensureAudioUrl() {
      const storagePath = player.dataset.materialAudio;
      if (!storagePath) {
        showNotice("No se encontró la ruta del audio guardado.", "error");
        return false;
      }

      const expiresAt = Number(player.dataset.materialAudioUrlExpiresAt || 0);
      if (player.src && expiresAt > Date.now() + 15000) return true;

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
        player.load();
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
    player.addEventListener("loadedmetadata", updateAudioUi);
    player.addEventListener("durationchange", updateAudioUi);
    player.addEventListener("seeked", updateAudioUi);
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
      const estimatedHeight = 76;
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

}


