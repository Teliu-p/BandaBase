/* Persistencia del editor de Materiales. */

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
