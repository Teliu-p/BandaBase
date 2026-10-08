async function bandabaseReloadAfterDelete(
  type
) {
  if (type === "song") {
    await loadSongs();
    return;
  }

  if (type === "list") {
    await loadBandLists();
    return;
  }

  if (type === "proposal") {
    await loadProposals();
    return;
  }

  if (type === "generalComment") {
    await loadGeneralComments();
    await loadRecentGeneralComments();
    return;
  }

  if (type === "songComment") {
    await loadComments();
  }
}


window.bandabaseDeleteSelected =
  async function(type, ids) {
    const uniqueIds = [
      ...new Set(
        (ids || []).filter(Boolean)
      )
    ];

    if (
      !type ||
      !uniqueIds.length
    ) {
      return {
        error: null
      };
    }

    const labels = {
      song: "canción",
      list: "lista",
      proposal: "propuesta",
      generalComment: "comentario",
      songComment: "comentario"
    };

    const label =
      labels[type] ||
      "elemento";

    const plural =
      uniqueIds.length === 1
        ? label
        : (
            type === "song"
              ? "canciones"
              : type === "list"
                ? "listas"
                : type === "proposal"
                  ? "propuestas"
                  : "comentarios"
          );

    if (
      !window.confirm(
        "¿Eliminar " +
        uniqueIds.length +
        " " +
        plural +
        " seleccionado" +
        (
          uniqueIds.length === 1
            ? ""
            : "s"
        ) +
        "?"
      )
    ) {
      return {
        cancelled: true,
        error: null
      };
    }

    let result = {
      error: null
    };

    try {
      if (type === "song") {
        result =
          await deleteSongs(
            supabaseClient,
            uniqueIds
          );
      } else if (type === "list") {
        result =
          await deleteBandLists(
            supabaseClient,
            uniqueIds
          );
      } else if (type === "proposal") {
        result =
          await deleteProposals(
            supabaseClient,
            uniqueIds
          );
      } else if (
        type === "generalComment" ||
        type === "songComment"
      ) {
        result =
          await deleteComments(
            supabaseClient,
            uniqueIds
          );
      } else {
        return {
          error:
            new Error(
              "Tipo de eliminación no reconocido."
            )
        };
      }

      await bandabaseReloadAfterDelete(
        type
      );
    } catch (error) {
      result = {
        error
      };

      await bandabaseReloadAfterDelete(
        type
      );
    }

    if (result.error) {
      showNotice(
        result.error.message ||
          "No se pudieron eliminar todos los elementos seleccionados.",
        "error"
      );
      return result;
    }

    showNotice(
      uniqueIds.length === 1
        ? "Elemento eliminado."
        : uniqueIds.length +
          " elementos eliminados.",
      "success"
    );

    return result;
  };

/* ============================================================
   INICIALIZACIÓN
============================================================ */

function initializeSongListsDialogUI() {
  document
    .getElementById("closeSongListsBtn")
    .addEventListener("click", closeSongListsDialog);

  document
    .getElementById("cancelSongListsBtn")
    .addEventListener("click", closeSongListsDialog);

  document
    .getElementById("saveSongListsBtn")
    .addEventListener("click", () => {
      void saveSongListAssignments();
    });
}


async function initializeApp() {

  await loadCurrentBand();
  await loadCurrentProfile();
  await loadSongs();

  setupNavigation();
  initializeBandListsUI();
  initializeSongListsDialogUI();
  initializeAdminUI();
  await refreshBandListData();
  renderSongs();

  showSection(
    getSavedSection()
  );

}
