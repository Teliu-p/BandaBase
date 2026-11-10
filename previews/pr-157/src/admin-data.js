const AUDIT_COLUMNS = [
  "id",
  "band_id",
  "actor_user_id",
  "entity_type",
  "entity_id",
  "action",
  "before_data",
  "after_data",
  "created_at"
].join(", ");

async function getAuditLogByBandId(
  supabaseClient,
  bandId,
  limit = 100
) {
  return await supabaseClient
    .from("audit_log")
    .select(AUDIT_COLUMNS)
    .eq("band_id", bandId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

async function getTrashRecords(
  supabaseClient,
  bandId
) {
  const [
    songsResult,
    listsResult,
    proposalsResult,
    commentsResult
  ] = await Promise.all([
    supabaseClient
      .from("songs")
      .select("id, band_id, name, artist, created_by, created_at, deleted_at, deleted_by")
      .eq("band_id", bandId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    supabaseClient
      .from("band_lists")
      .select("id, band_id, title, created_by, created_at, deleted_at, deleted_by")
      .eq("band_id", bandId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    supabaseClient
      .from("proposals")
      .select("id, band_id, title, created_by, created_at, deleted_at, deleted_by")
      .eq("band_id", bandId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    supabaseClient
      .from("comments")
      .select("id, band_id, song_id, user_id, content, created_at, deleted_at, deleted_by")
      .eq("band_id", bandId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
  ]);

  const error =
    songsResult.error ||
    listsResult.error ||
    proposalsResult.error ||
    commentsResult.error;

  if (error) {
    return {
      data: null,
      error
    };
  }

  return {
    data: {
      songs: songsResult.data || [],
      lists: listsResult.data || [],
      proposals: proposalsResult.data || [],
      comments: commentsResult.data || []
    },
    error: null
  };
}

async function restoreAuditSnapshot(
  supabaseClient,
  auditRow
) {
  const tableMap = {
    songs: "songs",
    band_lists: "band_lists",
    proposals: "proposals",
    comments: "comments"
  };

  const table = tableMap[auditRow?.entity_type];
  const before = auditRow?.before_data;
  const id = auditRow?.entity_id;

  if (!table || !before || !id) {
    return {
      error: new Error(
        "Este cambio no se puede restaurar desde aquí."
      )
    };
  }

  const columnMap = {
    songs: [
      "name",
      "artist",
      "genre",
      "bpm",
      "song_key",
      "singer",
      "list_status",
      "status",
      "active_status",
      "color",
      "duration",
      "meter",
      "original_bpm",
      "original_key",
      "original_duration",
      "original_meter",
      "deleted_at",
      "deleted_by"
    ],
    band_lists: [
      "title",
      "status",
      "notes",
      "deleted_at",
      "deleted_by"
    ],
    proposals: [
      "title",
      "detail",
      "status",
      "voting_type",
      "voting_visibility",
      "decided_at",
      "deleted_at",
      "deleted_by"
    ],
    comments: [
      "content",
      "deleted_at",
      "deleted_by"
    ]
  };

  const row = {};
  (columnMap[table] || []).forEach(column => {
    if (
      Object.prototype.hasOwnProperty.call(
        before,
        column
      )
    ) {
      row[column] = before[column];
    }
  });

  return await supabaseClient.rpc(
    "restore_band_change",
    {
      p_audit_id: auditRow.id
    }
  );
}

async function restoreTrashRecord(
  supabaseClient,
  entityType,
  entityId
) {
  const tableMap = {
    songs: "songs",
    band_lists: "band_lists",
    proposals: "proposals",
    comments: "comments"
  };

  const table = tableMap[entityType];

  if (!table) {
    return {
      error: new Error(
        "Tipo de elemento no válido."
      )
    };
  }

  return await supabaseClient
    .from(table)
    .update({
      deleted_at: null,
      deleted_by: null
    })
    .eq("id", entityId)
    .select("*")
    .single();
}

async function updateBandMemberRole(
  supabaseClient,
  userId,
  role
) {
  return await supabaseClient
    .from("band_members")
    .update({ role })
    .eq("band_id", currentBand.id)
    .eq("user_id", userId)
    .select("user_id, role, active, display_name, tags")
    .single();
}
