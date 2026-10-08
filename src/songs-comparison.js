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
