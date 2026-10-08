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

  if (attachment?.kind === "link") {
    return "🔗";
  }

  if (
    String(
      attachment?.mime_type || ""
    ).startsWith("audio/")
  ) {
    return "🎧";
  }

  if (
    String(
      attachment?.mime_type || ""
    ).includes("pdf")
  ) {
    return "📄";
  }

  return "📎";

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


function rememberMaterialSelection() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(0);

  if (
    editor.contains(
      range.startContainer
    ) &&
    editor.contains(
      range.endContainer
    )
  ) {

    materialSelectionRange =
      range.cloneRange();

  }

}


function restoreMaterialSelection() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (
    !editor ||
    !materialSelectionRange
  ) {
    return false;
  }

  const selection =
    window.getSelection();

  try {

    selection.removeAllRanges();

    selection.addRange(
      materialSelectionRange
    );

    return true;

  } catch (error) {

    return false;

  }

}


function createMaterialInlineAttachment(
  attachment,
  pendingKey = null
) {

  const wrapper =
    document.createElement("span");

  wrapper.className =
    "material-inline-attachment";

  wrapper.contentEditable =
    "false";

  if (attachment?.id) {

    wrapper.dataset.attachmentId =
      attachment.id;

  }

  if (pendingKey) {

    wrapper.dataset.pendingKey =
      pendingKey;

  }

  const icon =
    getMaterialAttachmentIcon(
      attachment
    );

  const name =
    attachment?.name ||
    "Archivo";

  const label =
    document.createTextNode(
      icon +
      " " +
      name +
      " "
    );

  wrapper.appendChild(
    label
  );

  const removeButton =
    document.createElement(
      "button"
    );

  removeButton.type =
    "button";

  removeButton.className =
    "inline-remove";

  removeButton.textContent =
    "×";

  removeButton.title =
    "Quitar";

  removeButton.setAttribute(
    "aria-label",
    "Quitar " + name
  );

  removeButton.addEventListener(
    "mousedown",
    function(event) {

      event.preventDefault();

    }
  );

  removeButton.addEventListener(
    "click",
    function(event) {

      event.preventDefault();

      wrapper.remove();

    }
  );

  wrapper.appendChild(
    removeButton
  );

  return wrapper;

}


function insertMaterialNodeAtSelection(
  node
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  editor.focus();

  const hasSelection =
    restoreMaterialSelection();

  let range =
    materialSelectionRange;

  if (
    !hasSelection
  ) {

    range =
      document.createRange();

    range.selectNodeContents(
      editor
    );

    range.collapse(
      false
    );

  }

  range.deleteContents();

  const spacerBefore =
    document.createTextNode(
      " "
    );

  const spacerAfter =
    document.createTextNode(
      " "
    );

  range.insertNode(
    spacerAfter
  );

  range.insertNode(
    node
  );

  range.insertNode(
    spacerBefore
  );

  range.setStartAfter(
    spacerAfter
  );

  range.collapse(
    true
  );

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(
    range
  );

  materialSelectionRange =
    range.cloneRange();

}


function renderMaterialComposer(
  blocks
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  editor.innerHTML =
    "";

  const safeBlocks =
    blocks?.length
      ? blocks
      : [
          {
            block_type:
              "text",
            content:
              ""
          }
        ];

  safeBlocks.forEach(
    block => {

      if (
        block.block_type ===
        "text"
      ) {

        editor.appendChild(
          document.createTextNode(
            block.content || ""
          )
        );

        return;

      }

      if (
        block.block_type ===
        "attachment"
      ) {

        const attachment =
          block.attachment ||
          block.pending;

        if (!attachment) {
          return;
        }

        const inline =
          createMaterialInlineAttachment(
            attachment,
            block.pendingKey || null
          );

        editor.appendChild(
          inline
        );

      }

    }
  );

  if (
    !editor.childNodes.length
  ) {

    editor.appendChild(
      document.createTextNode("")
    );

  }

}


function collectMaterialComposerBlocks() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return [];
  }

  const blocks = [];
  let textBuffer = "";

  const flushText =
    function() {

      if (
        textBuffer.length ||
        !blocks.length
      ) {

        blocks.push({
          block_type:
            "text",
          content:
            textBuffer
        });

      }

      textBuffer =
        "";

    };

  editor.childNodes.forEach(
    node => {

      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {

        textBuffer +=
          node.textContent || "";

        return;

      }

      if (
        node.nodeType !==
        Node.ELEMENT_NODE
      ) {
        return;
      }

      const element =
        node;

      if (
        element.classList.contains(
          "material-inline-attachment"
        )
      ) {

        flushText();

        const attachmentId =
          element.dataset.attachmentId ||
          null;

        const pendingKey =
          element.dataset.pendingKey ||
          null;

        blocks.push({
          block_type:
            "attachment",
          attachment_id:
            attachmentId,
          pendingKey
        });

        return;

      }

      textBuffer +=
        element.innerText ||
        "";

    }
  );

  if (
    textBuffer.length ||
    !blocks.length
  ) {

    blocks.push({
      block_type:
        "text",
      content:
        textBuffer
    });

  }

  return blocks;

}


function collectMaterialLegacyText(
  blocks
) {

  return blocks
    .filter(
      block =>
        block.block_type ===
        "text"
    )
    .map(
      block =>
        block.content || ""
    )
    .join("\n\n")
    .trim();

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

    return (
      '<div class="material-view-text">' +
      (
        block.content
          ? escapeHtml(
              block.content
            )
          : ""
      ) +
      '</div>'
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

  if (
    attachment.kind ===
      "file" &&
    String(
      attachment.mime_type || ""
    ).startsWith("audio/")
  ) {

    return (
      '<div class="material-view-attachment">' +
      '<strong>' +
      icon +
      " " +
      escapeHtml(
        attachment.name
      ) +
      '</strong>' +
      '<div class="material-attachment-type">' +
      escapeHtml(
        getAttachmentLabel(
          attachment
        )
      ) +
      '</div>' +
      '<audio class="material-audio" controls preload="metadata" data-material-audio="' +
      escapeHtml(
        attachment.storage_path || ""
      ) +
      '"></audio>' +
      '</div>'
    );

  }

  return (
    '<div class="material-view-attachment">' +
    '<div class="detail-actions" style="align-items:center;">' +
    '<div style="min-width:0; flex:1;">' +
    '<strong>' +
    icon +
    " " +
    escapeHtml(
      attachment.name
    ) +
    '</strong>' +
    '<div class="material-attachment-type">' +
    escapeHtml(
      getAttachmentLabel(
        attachment
      )
    ) +
    (
      attachment.kind === "link" &&
      attachment.url
        ? " · " +
          escapeHtml(
            attachment.url
          )
        : ""
    ) +
    '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-subtle" data-open-attachment="' +
    escapeHtml(
      attachment.id
    ) +
    '">Abrir</button>' +
    '</div>' +
    '</div>'
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

  void hydrateMaterialAudioPlayers();

}


async function hydrateMaterialAudioPlayers() {

  const players =
    document.querySelectorAll(
      "[data-material-audio]"
    );

  for (
    const player
    of players
  ) {

    const storagePath =
      player.dataset.materialAudio;

    if (!storagePath) {
      continue;
    }

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from("materials")
        .createSignedUrl(
          storagePath,
          3600
        );

    if (
      error ||
      !data?.signedUrl
    ) {
      continue;
    }

    player.src =
      data.signedUrl;

  }

}


function bindMaterialViewEvents() {

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


function openMaterialEditor(
  material = null
) {

  editingMaterialId =
    material?.id ||
    null;

  materialDraftInitialAttachmentIds =
    new Set(
      (
        material?.attachments ||
        []
      ).map(
        attachment =>
          attachment.id
      )
    );

  materialPendingAttachments = {};

  document.getElementById(
    "materialName"
  ).value =
    material?.name ||
    "";

  renderMaterialComposer(
    material?.blocks ||
    [
      {
        block_type:
          "text",
        content:
          material?.content ||
          ""
      }
    ]
  );

  rememberMaterialSelection();

  document.getElementById(
    "materialForm"
  ).classList.remove(
    "hidden"
  );

  document.getElementById(
    "showMaterialFormBtn"
  ).textContent =
    material
      ? "Editando material"
      : "+ Añadir material";

  document.getElementById(
    "materialName"
  ).focus();

}


function showMaterialForm() {

  openMaterialEditor();

}


function hideMaterialForm() {

  editingMaterialId =
    null;

  materialDraftInitialAttachmentIds =
    new Set();

  materialSelectionRange =
    null;

  materialPendingAttachments =
    {};

  const form =
    document.getElementById(
      "materialForm"
    );

  form.classList.add(
    "hidden"
  );

  form.reset();

  document.getElementById(
    "materialComposerEditor"
  ).innerHTML =
    "";

  document.getElementById(
    "showMaterialFormBtn"
  ).textContent =
    "+ Añadir material";

}


document
  .getElementById(
    "showMaterialFormBtn"
  )
  .addEventListener(
    "click",
    showMaterialForm
  );


document
  .getElementById(
    "cancelMaterialBtn"
  )
  .addEventListener(
    "click",
    hideMaterialForm
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "keydown",
    function(event) {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        rememberMaterialSelection();

        const textNode =
          document.createTextNode(
            "\n"
          );

        insertMaterialNodeAtSelection(
          textNode
        );

        return;

      }

      if (
        event.key ===
        "Tab"
      ) {

        event.preventDefault();

        const textNode =
          document.createTextNode(
            "  "
          );

        insertMaterialNodeAtSelection(
          textNode
        );

      }

    }
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "keyup",
    rememberMaterialSelection
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "mouseup",
    rememberMaterialSelection
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "focus",
    rememberMaterialSelection
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "paste",
    function(event) {

      event.preventDefault();

      const text =
        event.clipboardData?.getData(
          "text/plain"
        ) ||
        "";

      rememberMaterialSelection();

      insertMaterialNodeAtSelection(
        document.createTextNode(
          text
        )
      );

    }
  );


document
  .getElementById(
    "insertMaterialFileBtn"
  )
  .addEventListener(
    "mousedown",
    function() {

      rememberMaterialSelection();

    }
  );


document
  .getElementById(
    "insertMaterialFileBtn"
  )
  .addEventListener(
    "click",
    function() {

      const input =
        document.getElementById(
          "materialPendingFile"
        );

      input.value =
        "";

      input.click();

    }
  );


document
  .getElementById(
    "materialPendingFile"
  )
  .addEventListener(
    "change",
    function() {

      const file =
        this.files &&
        this.files[0];

      if (!file) {
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      materialPendingAttachments[
        pendingKey
      ] = {
        kind:
          "file",
        name:
          file.name,
        mime_type:
          file.type || null,
        file
      };

      const node =
        createMaterialInlineAttachment(
          materialPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertMaterialNodeAtSelection(
        node
      );

      this.value =
        "";

    }
  );


document
  .getElementById(
    "insertMaterialLinkBtn"
  )
  .addEventListener(
    "mousedown",
    function() {

      rememberMaterialSelection();

    }
  );


document
  .getElementById(
    "insertMaterialLinkBtn"
  )
  .addEventListener(
    "click",
    function() {

      const name =
        window.prompt(
          "Nombre del enlace",
          "Enlace"
        );

      if (
        name === null
      ) {
        return;
      }

      const url =
        window.prompt(
          "Pegá la URL",
          "https://"
        );

      if (
        url === null
      ) {
        return;
      }

      const safeUrl =
        getSafeMaterialUrl(
          url
        );

      if (!safeUrl) {

        showNotice(
          "La URL debe comenzar con http:// o https://.",
          "error"
        );

        return;

      }

      const pendingKey =
        crypto.randomUUID();

      materialPendingAttachments[
        pendingKey
      ] = {
        kind:
          "link",
        name:
          name.trim() ||
          "Enlace",
        url:
          safeUrl,
        mime_type:
          null
      };

      const node =
        createMaterialInlineAttachment(
          materialPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertMaterialNodeAtSelection(
        node
      );

    }
  );


async function saveMaterialDraft() {

  if (
    !currentBand ||
    !currentSong ||
    !currentUser
  ) {
    return;
  }

  const name =
    document.getElementById(
      "materialName"
    ).value.trim();

  if (!name) {

    showNotice(
      "El título es obligatorio.",
      "error"
    );

    return;

  }

  const composedBlocks =
    collectMaterialComposerBlocks();

  let materialId =
    editingMaterialId;

  const originalMaterial =
    currentMaterials.find(
      material =>
        material.id ===
        materialId
    );

  const wasNew =
    !materialId;

  if (materialId) {

    const {
      error
    } =
      await updateMaterial(
        supabaseClient,
        materialId,
        {
          name,
          content:
            collectMaterialLegacyText(
              composedBlocks
            )
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
    } =
      await createMaterial(
        supabaseClient,
        {
          band_id:
            currentBand.id,
          song_id:
            currentSong.id,
          name,
          content:
            collectMaterialLegacyText(
              composedBlocks
            ),
          created_by:
            currentUser.id
        }
      );

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

  for (
    const block
    of composedBlocks
  ) {

    if (
      block.block_type ===
      "text"
    ) {

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

    if (
      block.attachment_id
    ) {

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
      materialPendingAttachments[
        block.pendingKey
      ];

    if (!pending) {
      continue;
    }

    if (
      pending.kind ===
      "link"
    ) {

      const {
        data: attachment,
        error
      } =
        await createMaterialAttachment(
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
          "El material se guardó, pero no se pudo registrar el enlace: " +
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
      "/" +
      crypto.randomUUID() +
      "-" +
      sanitizeStorageFileName(
        file.name
      );

    const {
      error: uploadError
    } =
      await supabaseClient
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
        "El material se guardó, pero no se pudo subir el archivo: " +
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
    } =
      await createMaterialAttachment(
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
  } =
    await replaceMaterialBlocks(
      supabaseClient,
      materialId,
      persistedBlocks.map(
        (
          block,
          index
        ) => ({
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
      "El material se guardó, pero no se pudo guardar el orden de su contenido: " +
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
    [...materialDraftInitialAttachmentIds]
      .filter(
        id =>
          !keptIds.has(id)
      );

  if (removedIds.length) {

    const removedAttachments =
      (
        originalMaterial?.attachments ||
        []
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
          "El contenido se guardó, pero algunos archivos quitados no pudieron borrarse del almacenamiento.",
          "error"
        );

      }

    }

    for (
      const attachmentId
      of removedIds
    ) {

      await deleteMaterialAttachment(
        supabaseClient,
        attachmentId
      );

    }

  }

  openMaterialIds.add(
    materialId
  );

  hideMaterialForm();

  showNotice(
    wasNew
      ? "Material agregado."
      : "Material actualizado.",
    "success"
  );

  await loadMaterials();

}


document
  .getElementById(
    "materialForm"
  )
  .addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();

      await saveMaterialDraft();

    }
  );
