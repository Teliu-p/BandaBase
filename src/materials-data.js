const MATERIAL_COLUMNS = `
  id,
  band_id,
  song_id,
  type,
  name,
  url,
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


async function createMaterial(
  supabaseClient,
  materialData
) {

  const {
    band_id,
    song_id,
    type,
    name,
    url,
    created_by
  } =
    materialData;

  return await supabaseClient
    .from("materials")
    .insert({
      band_id,
      song_id,
      type,
      name,
      url,
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
    type,
    name,
    url
  } =
    materialData;

  return await supabaseClient
    .from("materials")
    .update({
      type,
      name,
      url
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
