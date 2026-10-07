const BAND_LIST_COLUMNS = `
  id,
  band_id,
  title,
  list_date,
  list_time,
  status,
  notes,
  created_by,
  created_at
`;

const BAND_LIST_ITEM_COLUMNS = `
  id,
  list_id,
  item_type,
  title,
  details,
  song_id,
  member_user_id,
  status,
  position,
  created_by,
  created_at
`;

async function getBandListsByBandId(
  supabaseClient,
  bandId
) {
  return await supabaseClient
    .from("band_lists")
    .select(BAND_LIST_COLUMNS)
    .eq("band_id", bandId)
    .order("list_date", {
      ascending: false,
      nullsFirst: false
    })
    .order("list_time", {
      ascending: false,
      nullsFirst: false
    });
}

async function createBandList(
  supabaseClient,
  listData
) {
  return await supabaseClient
    .from("band_lists")
    .insert(listData)
    .select(BAND_LIST_COLUMNS)
    .single();
}

async function updateBandList(
  supabaseClient,
  listId,
  listData
) {
  return await supabaseClient
    .from("band_lists")
    .update(listData)
    .eq("id", listId)
    .select(BAND_LIST_COLUMNS)
    .single();
}

async function deleteBandList(
  supabaseClient,
  listId
) {
  return await supabaseClient
    .from("band_lists")
    .delete()
    .eq("id", listId);
}

async function getBandListItemsByListIds(
  supabaseClient,
  listIds
) {
  if (!listIds.length) {
    return {
      data: [],
      error: null
    };
  }

  return await supabaseClient
    .from("band_list_items")
    .select(BAND_LIST_ITEM_COLUMNS)
    .in("list_id", listIds)
    .order("position", {
      ascending: true
    });
}

async function replaceBandListItems(
  supabaseClient,
  listId,
  items
) {
  const {
    error: deleteError
  } = await supabaseClient
    .from("band_list_items")
    .delete()
    .eq("list_id", listId);

  if (deleteError) {
    return {
      data: null,
      error: deleteError
    };
  }

  if (!items.length) {
    return {
      data: [],
      error: null
    };
  }

  const rows = items.map((item, index) => ({
    ...item,
    list_id: listId,
    position: index
  }));

  return await supabaseClient
    .from("band_list_items")
    .insert(rows)
    .select(BAND_LIST_ITEM_COLUMNS);
}
