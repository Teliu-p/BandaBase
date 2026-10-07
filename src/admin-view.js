let adminHistoryRows = [];
let adminTrashData = null;

function bandabaseIsAdminRole() {
  return (
    currentBandRole === "owner" ||
    currentBandRole === "admin"
  );
}

function bandabaseIsOwnerRole() {
  return currentBandRole === "owner";
}

window.bandabaseIsAdmin = bandabaseIsAdminRole;

function adminEntityLabel(type) {
  const labels = {
    songs: "Canción",
    band_lists: "Lista",
    proposals: "Propuesta",
    comments: "Comentario",
    band_members: "Integrante",
    band_list_items: "Participación",
    band_list_managers: "Responsable"
  };

  return labels[type] || type;
}

function adminActionLabel(action) {
  const labels = {
    create: "creó",
    update: "editó",
    trash: "mandó a papelera",
    restore: "restauró",
    delete: "eliminó definitivamente"
  };

  return labels[action] || action;
}

function adminActorName(userId) {
  if (userId === currentUser?.id) {
    return (
      currentProfile?.full_name ||
      currentProfile?.display_name ||
      "Vos"
    );
  }

  const member =
    (allBandMembers || []).find(
      item =>
        item.user_id === userId
    );

  return (
    member?.display_name ||
    member?.profile?.full_name ||
    "Integrante"
  );
}

function adminSnapshotTitle(row) {
  const data =
    row.after_data ||
    row.before_data ||
    {};

  if (row.entity_type === "songs") {
    return data.name || "Canción";
  }

  if (row.entity_type === "band_lists") {
    return data.title || "Lista";
  }

  if (row.entity_type === "proposals") {
    return data.title || "Propuesta";
  }

  if (row.entity_type === "comments") {
    const text =
      String(data.content || "")
        .replace(/\s+/g, " ")
        .trim();

    return text
      ? (text.length > 90 ? text.slice(0, 90) + "…" : text)
      : "Comentario";
  }

  if (row.entity_type === "band_members") {
    return adminActorName(
      data.user_id || row.actor_user_id
    );
  }

  if (
    row.entity_type ===
    "band_list_managers"
  ) {
    return "Responsable de lista";
  }

  return adminEntityLabel(
    row.entity_type
  );
}

function adminChangedFields(row) {
  if (
    !row.before_data ||
    !row.after_data
  ) {
    return "";
  }

  const labels = {
    name: "nombre",
    artist: "artista",
    genre: "género",
    bpm: "BPM",
    song_key: "tonalidad",
    singer: "cantante",
    list_status: "estado",
    status: "estado",
    active_status: "actividad",
    color: "color",
    duration: "duración",
    meter: "compás",
    original_bpm: "BPM original",
    original_key: "tonalidad original",
    original_duration: "duración original",
    original_meter: "compás original",
    title: "título",
    notes: "notas",
    detail: "descripción",
    voting_type: "tipo de votación",
    voting_visibility: "visibilidad de votos",
    decided_at: "fecha de decisión",
    content: "contenido",
    role: "rol",
    active: "acceso"
  };

  const keys = new Set([
    ...Object.keys(row.before_data),
    ...Object.keys(row.after_data)
  ]);

  const changed = [];
  keys.forEach(key => {
    if (
      key === "updated_at" ||
      key === "deleted_at" ||
      key === "deleted_by" ||
      key === "created_at" ||
      key === "created_by" ||
      key === "band_id" ||
      key === "id"
    ) {
      return;
    }

    const before =
      row.before_data[key];
    const after =
      row.after_data[key];

    if (
      JSON.stringify(before) !==
      JSON.stringify(after)
    ) {
      changed.push(
        labels[key] || key
      );
    }
  });

  return changed.join(", ");
}

async function loadAdminPanel() {
  if (!bandabaseIsAdminRole() || !currentBand) {
    return;
  }

  const [
    auditResult,
    trashResult
  ] = await Promise.all([
    getAuditLogByBandId(
      supabaseClient,
      currentBand.id,
      100
    ),
    getTrashRecords(
      supabaseClient,
      currentBand.id
    )
  ]);

  if (auditResult.error) {
    showNotice(
      auditResult.error.message,
      "error"
    );
    return;
  }

  if (trashResult.error) {
    showNotice(
      trashResult.error.message,
      "error"
    );
    return;
  }

  adminHistoryRows =
    auditResult.data || [];
  adminTrashData =
    trashResult.data || {};

  await hydrateAdminHistoryNames();

  renderAdminHistory();
  renderAdminTrash();

  if (bandabaseIsOwnerRole()) {
    renderAdminMemberRoles();
  } else {
    const container =
      document.getElementById(
        "adminMemberRoles"
      );
    if (container) {
      container.innerHTML =
        '<div class="admin-empty">Solo el Owner puede designar Administradores.</div>';
    }
  }
}

async function hydrateAdminHistoryNames() {
  const userIds =
    [
      ...new Set(
        adminHistoryRows
          .map(row => row.actor_user_id)
          .filter(Boolean)
      )
    ];

  const missing =
    userIds.filter(
      userId =>
        !(allBandMembers || []).some(
          member =>
            member.user_id ===
            userId
        )
    );

  if (!missing.length || !currentBand) {
    return;
  }

  const { data } =
    await supabaseClient
      .from("band_members")
      .select(
        "user_id, role, active, display_name"
      )
      .eq(
        "band_id",
        currentBand.id
      )
      .in(
        "user_id",
        missing
      );

  (data || []).forEach(member => {
    allBandMembers.push({
      ...member,
      profile: {}
    });
  });
}

function renderAdminMemberRoles() {
  const container =
    document.getElementById(
      "adminMemberRoles"
    );

  if (!container) {
    return;
  }

  const members =
    (allBandMembers || [])
      .filter(member => member.active)
      .slice()
      .sort((a, b) =>
        String(
          a.display_name ||
          a.profile?.full_name ||
          ""
        ).localeCompare(
          String(
            b.display_name ||
            b.profile?.full_name ||
            ""
          ),
          "es"
        )
      );

  container.innerHTML =
    members
      .map(member => {
        const name =
          member.display_name ||
          member.profile?.full_name ||
          "Sin nombre";

        const role =
          member.role || "member";

        const control =
          role === "owner"
            ? '<span class="admin-role-badge">Owner</span>'
            : '<select class="admin-role-select" data-admin-role-user="' +
              escapeHtml(member.user_id) +
              '">' +
              '<option value="member"' +
              (role === "member" ? " selected" : "") +
              '>Integrante</option>' +
              '<option value="admin"' +
              (role === "admin" ? " selected" : "") +
              '>Administrador</option>' +
              "</select>";

        return (
          '<div class="admin-member-row">' +
            "<div>" +
              "<strong>" +
                escapeHtml(name) +
              "</strong>" +
              '<div class="comment-meta">' +
                escapeHtml(
                  member.profile?.instrument ||
                  ""
                ) +
              "</div>" +
            "</div>" +
            control +
          "</div>"
        );
      })
      .join("");

  container
    .querySelectorAll(
      "[data-admin-role-user]"
    )
    .forEach(select => {
      select.addEventListener(
        "change",
        async () => {
          const userId =
            select.dataset.adminRoleUser;

          const role =
            select.value;

          const result =
            await updateBandMemberRole(
              supabaseClient,
              userId,
              role
            );

          if (result.error) {
            showNotice(
              result.error.message,
              "error"
            );
            renderAdminMemberRoles();
            return;
          }

          const member =
            (allBandMembers || [])
              .find(
                item =>
                  item.user_id ===
                  userId
              );

          if (member) {
            member.role = role;
          }

          showNotice(
            role === "admin"
              ? "Administrador designado."
              : "Permisos de administrador retirados.",
            "success"
          );

          await loadAdminPanel();
        }
      );
    });
}

function renderAdminHistory() {
  const container =
    document.getElementById(
      "adminHistoryList"
    );

  if (!container) {
    return;
  }

  if (!adminHistoryRows.length) {
    container.innerHTML =
      '<div class="admin-empty">Todavía no hay cambios registrados.</div>';
    return;
  }

  container.innerHTML =
    adminHistoryRows
      .map(row => {
        const detail =
          adminChangedFields(row);

        const restorable =
          ["update", "trash"].includes(
            row.action
          ) &&
          row.before_data &&
          ["songs", "band_lists", "proposals", "comments"].includes(
            row.entity_type
          );

        return (
          '<div class="admin-history-row">' +
            '<div class="admin-history-main">' +
              "<strong>" +
                escapeHtml(
                  adminActorName(
                    row.actor_user_id
                  )
                ) +
              "</strong> " +
              escapeHtml(
                adminActionLabel(
                  row.action
                )
              ) +
              " " +
              escapeHtml(
                adminEntityLabel(
                  row.entity_type
                ).toLocaleLowerCase("es")
              ) +
              " · " +
              escapeHtml(
                adminSnapshotTitle(row)
              ) +
              '<div class="comment-meta">' +
                escapeHtml(
                  new Date(
                    row.created_at
                  ).toLocaleString(
                    "es-AR"
                  )
                ) +
                (
                  detail
                    ? " · Cambió: " +
                      escapeHtml(detail)
                    : ""
                ) +
              "</div>" +
            "</div>" +
            (
              restorable
                ? '<button type="button" class="btn btn-subtle" data-admin-restore="' +
                  escapeHtml(row.id) +
                  '">Restaurar</button>'
                : ""
            ) +
          "</div>"
        );
      })
      .join("");

  container
    .querySelectorAll(
      "[data-admin-restore]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const row =
            adminHistoryRows.find(
              item =>
                item.id ===
                button.dataset.adminRestore
            );

          if (!row) {
            return;
          }

          const confirmed =
            window.confirm(
              "Esto va a devolver el elemento al estado que tenía antes de ese cambio. Los cambios posteriores no se borran del historial. ¿Continuar?"
            );

          if (!confirmed) {
            return;
          }

          const result =
            await restoreAuditSnapshot(
              supabaseClient,
              row
            );

          if (result.error) {
            showNotice(
              result.error.message,
              "error"
            );
            return;
          }

          showNotice(
            "Cambio restaurado.",
            "success"
          );

          await loadAdminPanel();

          if (
            row.entity_type === "songs"
          ) {
            await loadSongs();
            await refreshBandListData();
            renderSongs();
          }

          if (
            row.entity_type ===
            "band_lists"
          ) {
            await loadBandLists();
          }

          if (
            row.entity_type ===
            "proposals"
          ) {
            await loadProposals();
          }

          if (
            row.entity_type ===
            "comments"
          ) {
            await loadGeneralComments();
            if (currentSong) {
              await loadComments();
            }
          }
        }
      );
    });
}

function renderAdminTrash() {
  const container =
    document.getElementById(
      "adminTrashList"
    );

  if (!container) {
    return;
  }

  const entries = [
    ...(adminTrashData?.songs || []).map(
      item => ({
        ...item,
        entity_type: "songs",
        title: item.name
      })
    ),
    ...(adminTrashData?.lists || []).map(
      item => ({
        ...item,
        entity_type: "band_lists",
        title: item.title
      })
    ),
    ...(adminTrashData?.proposals || []).map(
      item => ({
        ...item,
        entity_type: "proposals",
        title: item.title
      })
    ),
    ...(adminTrashData?.comments || []).map(
      item => ({
        ...item,
        entity_type: "comments",
        title:
          String(item.content || "")
            .replace(/\s+/g, " ")
            .trim() ||
          "Comentario"
      })
    )
  ].sort(
    (a, b) =>
      (Date.parse(b.deleted_at || "") || 0) -
      (Date.parse(a.deleted_at || "") || 0)
  );

  if (!entries.length) {
    container.innerHTML =
      '<div class="admin-empty">La papelera está vacía.</div>';
    return;
  }

  container.innerHTML =
    entries.map(item => {
      const title =
        item.title.length > 120
          ? item.title.slice(0, 120) + "…"
          : item.title;

      return (
        '<div class="admin-trash-row">' +
          '<div>' +
            "<strong>" +
              escapeHtml(title) +
            "</strong>" +
            '<div class="comment-meta">' +
              escapeHtml(
                adminEntityLabel(
                  item.entity_type
                )
              ) +
              " · " +
              escapeHtml(
                new Date(
                  item.deleted_at
                ).toLocaleString(
                  "es-AR"
                )
              ) +
            "</div>" +
          "</div>" +
          '<button type="button" class="btn btn-subtle" data-admin-trash-restore-type="' +
          escapeHtml(item.entity_type) +
          '" data-admin-trash-restore-id="' +
          escapeHtml(item.id) +
          '">Restaurar</button>' +
        "</div>"
      );
    }).join("");

  container
    .querySelectorAll(
      "[data-admin-trash-restore-id]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const confirmed =
            window.confirm(
              "¿Restaurar este elemento?"
            );

          if (!confirmed) {
            return;
          }

          const result =
            await restoreTrashRecord(
              supabaseClient,
              button.dataset.adminTrashRestoreType,
              button.dataset.adminTrashRestoreId
            );

          if (result.error) {
            showNotice(
              result.error.message,
              "error"
            );
            return;
          }

          showNotice(
            "Elemento restaurado.",
            "success"
          );

          await loadAdminPanel();
          await bandabaseReloadAfterDelete(
            button.dataset.adminTrashRestoreType ===
              "band_lists"
              ? "list"
              : button.dataset.adminTrashRestoreType ===
                  "proposals"
                ? "proposal"
                : button.dataset.adminTrashRestoreType ===
                    "comments"
                  ? "generalComment"
                  : "song"
          );
        }
      );
    });
}

function initializeAdminUI() {
  const navButton =
    document.getElementById(
      "adminNavBtn"
    );

  if (navButton) {
    navButton.classList.toggle(
      "hidden",
      !bandabaseIsAdminRole()
    );
  }
}

