const BAND_LIST_COLUMNS = `
  id,
  band_id,
  title,
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
    .order("created_at", { ascending: false });
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
    .order("position", { ascending: true });
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


async function addSongToBandList(
  supabaseClient,
  listId,
  song,
  position
) {
  return await supabaseClient
    .from("band_list_items")
    .insert({
      list_id: listId,
      item_type: "song",
      title: song.name || "Canción",
      details: null,
      song_id: song.id,
      member_user_id: null,
      status: null,
      position: Number.isInteger(position) && position >= 0 ? position : 0,
      created_by: currentUser?.id || null
    })
    .select(BAND_LIST_ITEM_COLUMNS)
    .single();
}

async function removeSongFromBandList(
  supabaseClient,
  listId,
  songId
) {
  return await supabaseClient
    .from("band_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("item_type", "song")
    .eq("song_id", songId);
}

async function deleteBandLists(
  supabaseClient,
  listIds
) {
  const ids = [
    ...new Set(
      (listIds || []).filter(Boolean)
    )
  ];

  if (!ids.length) {
    return { error: null };
  }

  return await supabaseClient
    .from("band_lists")
    .delete()
    .in("id", ids);
}


const BAND_LIST_MANAGER_COLUMNS = `
  id,
  list_id,
  user_id,
  created_by,
  created_at
`;


async function getBandListManagersByListIds(
  supabaseClient,
  listIds
) {
  if (!listIds.length) {
    return { data: [], error: null };
  }

  return await supabaseClient
    .from("band_list_managers")
    .select(BAND_LIST_MANAGER_COLUMNS)
    .in("list_id", listIds)
    .order("created_at", { ascending: true });
}


async function replaceBandListManagers(
  supabaseClient,
  listId,
  userIds
) {
  const {
    error: deleteError
  } = await supabaseClient
    .from("band_list_managers")
    .delete()
    .eq("list_id", listId);

  if (deleteError) {
    return { data: null, error: deleteError };
  }

  const ids = [
    ...new Set(
      (userIds || [])
        .filter(Boolean)
        .filter(
          userId =>
            userId !== currentUser?.id
        )
    )
  ];

  if (!ids.length) {
    return { data: [], error: null };
  }

  const rows = ids.map(userId => ({
    list_id: listId,
    user_id: userId,
    created_by: currentUser.id
  }));

  return await supabaseClient
    .from("band_list_managers")
    .insert(rows)
    .select(BAND_LIST_MANAGER_COLUMNS);
}


async function addCurrentUserToBandList(
  supabaseClient,
  listId
) {
  const existing =
    await supabaseClient
      .from("band_list_items")
      .select("id, status")
      .eq("list_id", listId)
      .eq("item_type", "member")
      .eq("member_user_id", currentUser.id)
      .maybeSingle();

  if (existing.error) {
    return existing;
  }

  if (existing.data) {
    if (existing.data.status === "Anotado") {
      return existing;
    }

    return await supabaseClient
      .from("band_list_items")
      .update({ status: "Anotado" })
      .eq("id", existing.data.id)
      .select(BAND_LIST_ITEM_COLUMNS)
      .single();
  }

  return await supabaseClient
    .from("band_list_items")
    .insert({
      list_id: listId,
      item_type: "member",
      title: bandListMemberName(
        currentUser.id
      ),
      details: null,
      song_id: null,
      member_user_id: currentUser.id,
      status: "Anotado",
      position: 0,
      created_by: currentUser.id
    })
    .select(BAND_LIST_ITEM_COLUMNS)
    .single();
}


async function removeCurrentUserFromBandList(
  supabaseClient,
  listId
) {
  return await supabaseClient
    .from("band_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("item_type", "member")
    .eq("member_user_id", currentUser.id)
    .eq("status", "Anotado");
}


async function setBandListMemberConfirmation(
  supabaseClient,
  itemId,
  status
) {
  return await supabaseClient
    .from("band_list_items")
    .update({
      status
    })
    .eq("id", itemId)
    .eq("item_type", "member")
    .select(BAND_LIST_ITEM_COLUMNS)
    .single();
}
