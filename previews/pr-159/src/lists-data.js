const BAND_LIST_COLUMNS = `
  id,
  band_id,
  title,
  status,
  notes,
  created_by,
  created_at,
  deleted_at,
  deleted_by,
  instrument_slots
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
  participation_instruments,
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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .select(BAND_LIST_COLUMNS)
    .single();
}

async function deleteBandList(
  supabaseClient,
  listId,
  deletedBy = currentUser?.id || null
) {
  return await supabaseClient
    .from("band_lists")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
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
  return await supabaseClient.rpc(
    "replace_band_list_items",
    {
      p_list_id: listId,
      p_items: (items || []).map(item => ({
        item_type: item.item_type,
        title: item.title,
        details: item.details ?? null,
        song_id: item.song_id ?? null,
        member_user_id: item.member_user_id ?? null,
        status: item.status ?? null,
        position: Number.isInteger(item.position)
          ? item.position
          : null,
        participation_instruments:
          normalizeBandInstruments(
            item.participation_instruments || []
          )
      }))
    }
  );
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
  listIds,
  deletedBy = currentUser?.id || null
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
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
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


async function saveBandListWithManagers(
  supabaseClient,
  listData
) {
  return await supabaseClient.rpc(
    "save_band_list_with_managers",
    {
      p_list_id: listData.list_id ?? null,
      p_band_id: listData.band_id ?? currentBand?.id ?? null,
      p_title: listData.title,
      p_status: listData.status ?? "Planificada",
      p_notes: listData.notes ?? null,
      p_instrument_slots: listData.instrument_slots ?? {},
      p_manager_user_ids: (listData.manager_user_ids || [])
        .filter(Boolean)
    }
  );
}

async function replaceSongListAssignments(
  supabaseClient,
  songId,
  addListIds,
  removeListIds
) {
  return await supabaseClient.rpc(
    "replace_song_list_assignments",
    {
      p_song_id: songId,
      p_add_list_ids: [...new Set((addListIds || []).filter(Boolean))],
      p_remove_list_ids: [...new Set((removeListIds || []).filter(Boolean))]
    }
  );
}


async function addCurrentUserToBandList(
  supabaseClient,
  listId,
  participationInstruments = []
) {
  const instruments =
    normalizeBandInstruments(participationInstruments);

  if (!instruments.length) {
    return {
      data: null,
      error: new Error("Elegí al menos un instrumento.")
    };
  }

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
    return await supabaseClient
      .from("band_list_items")
      .update({
        status: "Anotado",
        participation_instruments: instruments
      })
      .eq("id", existing.data.id)
      .select(BAND_LIST_ITEM_COLUMNS)
      .single();
  }

  return await supabaseClient
    .from("band_list_items")
    .insert({
      list_id: listId,
      item_type: "member",
      title: bandListMemberName(currentUser.id),
      details: null,
      song_id: null,
      member_user_id: currentUser.id,
      status: "Anotado",
      participation_instruments: instruments,
      position: 0,
      created_by: currentUser.id
    })
    .select(BAND_LIST_ITEM_COLUMNS)
    .single();
}

async function updateCurrentUserBandListParticipation(
  supabaseClient,
  listId,
  participationInstruments
) {
  return await addCurrentUserToBandList(
    supabaseClient,
    listId,
    participationInstruments
  );
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
    .eq("member_user_id", currentUser.id);
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
