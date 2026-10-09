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


function renderMaterialViewBlock(
  block
) {

  if (
    block.block_type ===
    "text"
  ) {

    const richText =
      renderMaterialRichTextHtml(
        block.content || ""
      );

    return (
      '<div class="material-view-text material-rich-text">' +
      (
        richText !== null
          ? richText
          : block.content
            ? renderMaterialAutoLinkedTextHtml(
                block.content
              )
            : ""
      ) +
      "</div>"
    );

  }

  const attachment =
    block.attachment;

  if (!attachment) {
    return "";
  }

  const icon =
    getMaterialAttachmentIcon(
      attachment
    );

  const secondaryText =
    getMaterialAttachmentSecondaryText(
      attachment
    );

  const actionLabel =
    attachment.kind ===
      "link"
      ? "Abrir enlace"
      : "Abrir";


  if (
    attachment.kind ===
      "file" &&
    String(
      attachment.mime_type || ""
    ).startsWith(
      "audio/"
    )
  ) {

    return (
      '<div class="material-view-attachment material-attachment-card material-attachment-audio">' +
        '<div class="material-attachment-card-main">' +
          '<span class="material-attachment-icon" aria-hidden="true">' +
            escapeHtml(icon) +
          "</span>" +
          '<div class="material-attachment-info">' +
            '<strong class="material-attachment-name">' +
              escapeHtml(
                attachment.name ||
                "Audio"
              ) +
            "</strong>" +
            '<span class="material-attachment-meta">' +
              escapeHtml(
                secondaryText
              ) +
            "</span>" +
          "</div>" +
        "</div>" +
        '<div class="material-audio-lazy-controls">' +
          '<button type="button" class="btn btn-subtle material-audio-load" data-material-audio-load>▶ Reproducir audio</button>' +
          '<audio class="material-audio" controls preload="none" data-material-audio="' +
            escapeHtml(
              attachment.storage_path || ""
            ) +
          '" hidden></audio>' +
        '</div>' +
      "</div>"
    );

  }


  return (
    '<div class="material-view-attachment material-attachment-card">' +
      '<div class="material-attachment-card-main">' +
        '<span class="material-attachment-icon" aria-hidden="true">' +
          escapeHtml(icon) +
        "</span>" +
        '<div class="material-attachment-info">' +
          '<strong class="material-attachment-name">' +
            escapeHtml(
              attachment.name ||
              "Archivo"
            ) +
          "</strong>" +
          '<span class="material-attachment-meta">' +
            escapeHtml(
              secondaryText
            ) +
          "</span>" +
        "</div>" +
      "</div>" +
      '<button type="button" class="material-attachment-open btn btn-subtle" data-open-attachment="' +
        escapeHtml(
          attachment.id
        ) +
      '">' +
        escapeHtml(
          actionLabel
        ) +
      "</button>" +
    "</div>"
  );

}


function renderMaterials() {

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

  document
    .querySelectorAll(
      "[data-material-audio-load]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async function() {
            if (button.dataset.loading === "true") {
              return;
            }

            const wrapper =
              button.closest(
                ".material-audio-lazy-controls"
              );

            const player =
              wrapper?.querySelector(
                "[data-material-audio]"
              );

            const storagePath =
              player?.dataset.materialAudio;

            if (!player || !storagePath) {
              return;
            }

            button.dataset.loading = "true";
            button.disabled = true;
            button.textContent = "Preparando audio…";

            let signedUrl = null;
            let loadError = null;

            try {
              const response =
                await supabaseClient
                  .storage
                  .from("materials")
                  .createSignedUrl(
                    storagePath,
                    3600
                  );

              signedUrl = response.data?.signedUrl || null;
              loadError = response.error || null;
            } catch (error) {
              loadError = error;
            }

            if (loadError || !signedUrl) {
              button.dataset.loading = "false";
              button.disabled = false;
              button.textContent = "Reintentar audio";

              showNotice(
                loadError?.message ||
                  "No se pudo cargar el audio.",
                "error"
              );
              return;
            }

            player.src = signedUrl;
            player.hidden = false;
            button.hidden = true;

            try {
              await player.play();
            } catch {
              // Algunos navegadores exigen un toque adicional en Play
              // después de completar la solicitud de la URL.
            }
          }
        );
      }
    );

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


