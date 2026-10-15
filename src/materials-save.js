/* Persistencia del editor de Materiales. */

let materialSaveInProgress = false;

function setMaterialSaveProgress(message) {
  if (!materialSaveInProgress) return;
  const form = document.getElementById("materialForm");
  const button = form?.querySelector?.('button[type="submit"]');
  if (button) button.textContent = message;
}

/* Compensación de escrituras parciales cuando falla la persistencia de bloques. */
async function cleanupFailedMaterialSave({
  materialId,
  wasNew,
  originalMaterial,
  createdAttachmentIds,
  uploadedStoragePaths
}) {
  const cleanupErrors = [];
  const storagePaths = [...new Set(uploadedStoragePaths || [])];

  function recordCleanupError(message, error) {
    cleanupErrors.push(
      message + ": " + (error?.message || String(error || "Error desconocido"))
    );
  }

  if (storagePaths.length) {
    try {
      const { error } = await supabaseClient
        .storage
        .from("materials")
        .remove(storagePaths);

      if (error) {
        recordCleanupError(
          "No se pudieron quitar algunos archivos del almacenamiento",
          error
        );
      }
    } catch (error) {
      recordCleanupError(
        "No se pudieron quitar algunos archivos del almacenamiento",
        error
      );
    }
  }

  for (const attachmentId of [...(createdAttachmentIds || [])].reverse()) {
    try {
      const { error } = await deleteMaterialAttachment(
        supabaseClient,
        attachmentId
      );

      if (error) {
        recordCleanupError(
          "No se pudo eliminar el registro de un adjunto",
          error
        );
      }
    } catch (error) {
      recordCleanupError(
        "No se pudo eliminar el registro de un adjunto",
        error
      );
    }
  }

  if (wasNew) {
    try {
      const { error } = await deleteMaterial(
        supabaseClient,
        materialId
      );

      if (error) {
        recordCleanupError(
          "No se pudo eliminar el material incompleto",
          error
        );
      }
    } catch (error) {
      recordCleanupError(
        "No se pudo eliminar el material incompleto",
        error
      );
    }
  } else if (originalMaterial) {
    try {
      const { error } = await updateMaterial(
        supabaseClient,
        materialId,
        {
          name: originalMaterial.name,
          content: originalMaterial.content
        }
      );

      if (error) {
        recordCleanupError(
          "No se pudieron restaurar el título y el texto anteriores",
          error
        );
      }
    } catch (error) {
      recordCleanupError(
        "No se pudieron restaurar el título y el texto anteriores",
        error
      );
    }
  } else {
    cleanupErrors.push(
      "No se encontró la versión original para restaurar el material editado."
    );
  }

  return cleanupErrors;
}

function getMaterialSaveFailureNotice(message, cleanupErrors) {
  if (!cleanupErrors.length) {
    return message + " Se revirtieron los cambios parciales.";
  }

  return message + " La limpieza también encontró problemas: " +
    cleanupErrors.join(" | ");
}


async function saveMaterialDraft() {

  if (
    !currentBand ||
    !currentSong ||
    !currentUser
  ) {
    showNotice(
      "No se pudo iniciar el guardado porque se perdió el contexto de banda o canción. Recargá la página y volvé a intentarlo.",
      "error"
    );
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

  setMaterialSaveProgress("Preparando guardado…");

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

  const createdAttachmentIds = [];
  const uploadedStoragePaths = [];

  async function abortSaveWithError(
    message
  ) {

    const cleanupErrors =
      await cleanupFailedMaterialSave({
        materialId,
        wasNew,
        originalMaterial,
        createdAttachmentIds,
        uploadedStoragePaths
      });

    showNotice(
      getMaterialSaveFailureNotice(
        message,
        cleanupErrors
      ),
      "error"
    );

  }

  let blocksWriteStarted = false;
  let blocksPersisted = false;

  try {

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
  const pendingAttachmentCount = composedBlocks.filter(
    block => block.block_type === "attachment" && !block.attachment_id
  ).length;
  let processedAttachmentCount = 0;

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

      await abortSaveWithError(
        "No se encontró el archivo adjunto pendiente. No se guardó este cambio; volvé a adjuntar el archivo e intentá de nuevo."
      );

      return;

    }

    processedAttachmentCount += 1;
    setMaterialSaveProgress(
      "Guardando adjunto " + processedAttachmentCount + " de " + pendingAttachmentCount + "…"
    );

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
        const cleanupErrors = await cleanupFailedMaterialSave({
          materialId,
          wasNew,
          originalMaterial,
          createdAttachmentIds,
          uploadedStoragePaths
        });

        showNotice(
          getMaterialSaveFailureNotice(
            "No se pudo registrar el enlace: " + error.message,
            cleanupErrors
          ),
          "error"
        );

        return;
      }

      createdAttachmentIds.push(attachment.id);

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

    if (
      pending.kind !== "file" ||
      !file
    ) {

      await abortSaveWithError(
        "El archivo adjunto perdió sus datos antes de guardarse. No se guardó este cambio; volvé a adjuntar el archivo e intentá de nuevo."
      );

      return;

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

    uploadedStoragePaths.push(storagePath);

    setMaterialSaveProgress(
      "Subiendo archivo " + processedAttachmentCount + " de " + pendingAttachmentCount + "…"
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
      const cleanupErrors = await cleanupFailedMaterialSave({
        materialId,
        wasNew,
        originalMaterial,
        createdAttachmentIds,
        uploadedStoragePaths
      });

      showNotice(
        getMaterialSaveFailureNotice(
          "No se pudo subir el archivo " + file.name + ": " + uploadError.message,
          cleanupErrors
        ),
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
      const cleanupErrors = await cleanupFailedMaterialSave({
        materialId,
        wasNew,
        originalMaterial,
        createdAttachmentIds,
        uploadedStoragePaths
      });

      showNotice(
        getMaterialSaveFailureNotice(
          "El archivo se subió, pero no se pudo registrar: " + error.message,
          cleanupErrors
        ),
        "error"
      );

      return;
    }

    createdAttachmentIds.push(attachment.id);

    persistedBlocks.push({
      block_type:
        "attachment",
      content:
        null,
      attachment_id:
        attachment.id
    });

  }

  setMaterialSaveProgress("Guardando contenido…");
  // The RPC and its response can become ambiguous if the network drops after
  // PostgreSQL commits. Never delete its attachments until that outcome is known.
  blocksWriteStarted = true;

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
    const cleanupErrors = await cleanupFailedMaterialSave({
      materialId,
      wasNew,
      originalMaterial,
      createdAttachmentIds,
      uploadedStoragePaths
    });

    showNotice(
      getMaterialSaveFailureNotice(
        "No se pudo guardar el orden del contenido: " + blocksError.message,
        cleanupErrors
      ),
      "error"
    );

    return;
  }

  blocksPersisted = true;
  setMaterialSaveProgress("Finalizando guardado…");

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

  const cleanupWarnings = [];
  const retainedAttachmentIds = new Set();

  if (removedIds.length) {
    const removedAttachments =
      (originalMaterial?.attachments || []).filter(
        attachment => removedIds.includes(attachment.id)
      );

    const fileAttachments = removedAttachments.filter(
      attachment => attachment.kind === "file" && attachment.storage_path
    );
    const storagePaths = fileAttachments.map(
      attachment => attachment.storage_path
    );

    if (storagePaths.length) {
      let storageCleanupFailed = false;

      try {
        const { error: storageError } = await supabaseClient
          .storage
          .from("materials")
          .remove(storagePaths);

        storageCleanupFailed = Boolean(storageError);
      } catch (error) {
        storageCleanupFailed = true;
      }

      if (storageCleanupFailed) {
        fileAttachments.forEach(
          attachment => retainedAttachmentIds.add(attachment.id)
        );
        cleanupWarnings.push(
          "No se pudieron borrar algunos archivos quitados del almacenamiento; se conservaron sus registros para reintentar la limpieza."
        );
      }
    }

    for (const attachmentId of removedIds) {
      if (retainedAttachmentIds.has(attachmentId)) {
        continue;
      }

      try {
        const { error } = await deleteMaterialAttachment(
          supabaseClient,
          attachmentId
        );

        if (error) {
          cleanupWarnings.push(
            "No se pudo quitar el registro de un recurso; se conservará para reintentar la limpieza."
          );
        }
      } catch (error) {
        cleanupWarnings.push(
          "No se pudo quitar el registro de un recurso; se conservará para reintentar la limpieza."
        );
      }
    }
  }

  openMaterialIds.add(
    materialId
  );

  hideMaterialForm();

  const successMessage =
    wasNew
      ? "Material agregado."
      : "Material actualizado.";

  showNotice(
    cleanupWarnings.length
      ? successMessage + " " + cleanupWarnings.join(" ")
      : successMessage,
    cleanupWarnings.length
      ? "error"
      : "success"
  );

  await loadMaterials();

  } catch (error) {
    console.error("Error inesperado al guardar Materiales:", error);

    if (blocksPersisted) {
      showNotice(
        "El material quedó guardado, pero hubo un problema al actualizar la vista: " +
          (error?.message || String(error || "Error desconocido")),
        "error"
      );
      return;
    }

    if (blocksWriteStarted) {
      showNotice(
        "Se interrumpió la conexión mientras se confirmaba el contenido. Conservé los adjuntos por seguridad porque el servidor podría haber guardado el material. Recargá la canción y revisá Materiales antes de volver a intentar.",
        "error"
      );
      return;
    }

    const cleanupErrors = await cleanupFailedMaterialSave({
      materialId,
      wasNew: wasNew && Boolean(materialId),
      originalMaterial,
      createdAttachmentIds,
      uploadedStoragePaths
    });

    showNotice(
      getMaterialSaveFailureNotice(
        "No se pudo guardar el material: " +
          (error?.message || String(error || "Error desconocido")),
        cleanupErrors
      ),
      "error"
    );
  }

}


document
  .getElementById(
    "materialForm"
  )
  .addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();

      if (materialSaveInProgress) return;

      const form = document.getElementById("materialForm");
      const button = form?.querySelector?.('button[type="submit"]');
      const originalButtonText = button?.textContent || "Guardar material";
      materialSaveInProgress = true;

      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = "Guardando material…";
      }

      try {
        await saveMaterialDraft();
      } catch (error) {
        console.error("Error inesperado al iniciar el guardado de Materiales:", error);
        showNotice(
          "No se pudo iniciar el guardado: " +
            (error?.message || String(error || "Error desconocido")),
          "error"
        );
      } finally {
        materialSaveInProgress = false;
        if (button) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.textContent = originalButtonText;
        }
      }

    }
  );
