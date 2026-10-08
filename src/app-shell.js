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
   COLOR PICKER
============================================================ */

function renderColorPicker(
  container,
  selectedColor,
  onSelect
) {

  container.innerHTML = "";

  const noneButton =
    document.createElement("button");

  noneButton.type = "button";

  noneButton.className =
    "color-option";

  if (
    !selectedColor
  ) {
    noneButton.classList.add("selected");
  }

  noneButton.title =
    "Sin color";

  noneButton.setAttribute(
    "aria-label",
    "Sin color"
  );

  noneButton.innerHTML = `
    <span class="color-none"></span>
  `;

  /*
    IMPORTANTE:
    El click se conecta directamente acá.
    No dependemos de un formulario ni de un input oculto.
  */

  noneButton.addEventListener(
    "click",
    function(event) {

      event.preventDefault();
      event.stopPropagation();

      onSelect(null);

      renderColorPicker(
        container,
        null,
        onSelect
      );

    }
  );

  container.appendChild(
    noneButton
  );


  SONG_COLORS.forEach(color => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "color-option";

    if (
      selectedColor === color.value
    ) {
      button.classList.add("selected");
    }

    button.title =
      color.name;

    button.setAttribute(
      "aria-label",
      "Color " + color.name
    );

    button.innerHTML = `
      <span
        class="color-swatch"
        style="background:${color.value};"
      ></span>
    `;

    button.addEventListener(
      "click",
      function(event) {

        event.preventDefault();
        event.stopPropagation();

        onSelect(color.value);

        renderColorPicker(
          container,
          color.value,
          onSelect
        );

      }
    );

    container.appendChild(
      button
    );

  });

}


/* ============================================================
   SELECTOR DE COLOR DE FILTRO
============================================================ */

function populateColorFilter() {
  populateMultiSongFilter(
    "filterColor",
    "Todos los colores",
    SONG_COLORS.map(
      color =>
        color.value
    ),
    value => {
      const color =
        SONG_COLORS.find(
          item =>
            item.value === value
        );

      return color
        ? color.name
        : value;
    }
  );
}


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
