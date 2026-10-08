const MATERIAL_COLUMNS = `
  id,
  band_id,
  song_id,
  type,
  name,
  url,
  content,
  created_by,
  created_at
`;


const ATTACHMENT_COLUMNS = `
  id,
  material_id,
  kind,
  name,
  url,
  storage_path,
  mime_type,
  created_by,
  created_at
`;


async function getMaterialsBySongId(
  supabaseClient,
  songId
) {

  return await supabaseClient
    .from("materials")
    .select(MATERIAL_COLUMNS)
    .eq(
      "song_id",
      songId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

}


async function getMaterialAttachments(
  supabaseClient,
  materialIds
) {

  if (!materialIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("material_attachments")
    .select(ATTACHMENT_COLUMNS)
    .in(
      "material_id",
      materialIds
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

}


async function createMaterial(
  supabaseClient,
  materialData
) {

  const {
    band_id,
    song_id,
    name,
    content,
    created_by
  } =
    materialData;

  return await supabaseClient
    .from("materials")
    .insert({
      band_id,
      song_id,
      type: "Texto",
      name,
      content,
      created_by
    })
    .select(MATERIAL_COLUMNS)
    .single();

}


async function updateMaterial(
  supabaseClient,
  materialId,
  materialData
) {

  const {
    name,
    content
  } =
    materialData;

  return await supabaseClient
    .from("materials")
    .update({
      name,
      content
    })
    .eq(
      "id",
      materialId
    );

}


async function deleteMaterial(
  supabaseClient,
  materialId
) {

  return await supabaseClient
    .from("materials")
    .delete()
    .eq(
      "id",
      materialId
    );

}


async function createMaterialAttachment(
  supabaseClient,
  attachmentData
) {

  return await supabaseClient
    .from("material_attachments")
    .insert(
      attachmentData
    )
    .select(ATTACHMENT_COLUMNS)
    .single();

}


async function deleteMaterialAttachment(
  supabaseClient,
  attachmentId
) {

  return await supabaseClient
    .from("material_attachments")
    .delete()
    .eq(
      "id",
      attachmentId
    );

}


const MATERIAL_BLOCK_COLUMNS = `
  id,
  material_id,
  block_type,
  content,
  attachment_id,
  position,
  created_at
`;


async function getMaterialBlocksByMaterialIds(
  supabaseClient,
  materialIds
) {

  if (!materialIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("material_blocks")
    .select(MATERIAL_BLOCK_COLUMNS)
    .in(
      "material_id",
      materialIds
    )
    .order(
      "position",
      {
        ascending: true
      }
    );

}


async function replaceMaterialBlocks(
  supabaseClient,
  materialId,
  blocks
) {
  return await supabaseClient.rpc(
    "replace_material_blocks",
    {
      p_material_id: materialId,
      p_blocks: (blocks || []).map(item => ({
        block_type: item.block_type,
        content: item.content ?? null,
        attachment_id: item.attachment_id ?? null,
        position: Number.isInteger(item.position)
          ? item.position
          : null
      }))
    }
  );
}
