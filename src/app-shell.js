/* ============================================================
   SUPABASE
============================================================ */

const SUPABASE_URL =
  "https://evuwcikuxptrgzdzejov.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_ERDp1BzfCrzk3QBQf6rKSQ_FGogulnV";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* ============================================================
   COLORES
============================================================ */

const SONG_COLORS = [
  {
    name: "Rojo",
    value: "#E74C3C"
  },
  {
    name: "Naranja",
    value: "#E67E22"
  },
  {
    name: "Amarillo",
    value: "#F1C40F"
  },
  {
    name: "Verde lima",
    value: "#8BC34A"
  },
  {
    name: "Verde",
    value: "#2ECC71"
  },
  {
    name: "Turquesa",
    value: "#1ABC9C"
  },
  {
    name: "Cian",
    value: "#00A8CC"
  },
  {
    name: "Azul",
    value: "#3498DB"
  },
  {
    name: "Azul oscuro",
    value: "#2E5AAC"
  },
  {
    name: "Violeta",
    value: "#8E44AD"
  },
  {
    name: "Magenta",
    value: "#C445B5"
  },
  {
    name: "Rosa",
    value: "#E85D8E"
  },
  {
    name: "Marrón",
    value: "#8D6E63"
  },
  {
    name: "Gris",
    value: "#7F8C8D"
  }
];


/* ============================================================
   ESTADO
============================================================ */

let currentUser = null;
let currentBand = null;
let currentProfile = null;
let currentBandRole = "member";

let allSongs = [];
let songSingersMap = {};
let allBandMembers = [];
let bandMemberProfilesMap = {};

let currentSong = null;
let currentMaterials = [];
let currentOriginalComparisonMaterial = null;
let navigationInitialized = false;
let initializedUserId = null;
let initializingUserId = null;

let currentBandLists = [];
let bandListItemsMap = {};
let bandListManagersMap = {};
let currentBandList = null;

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

let editingBandListId = null;

let selectedNewSongColor = null;
let selectedDetailSongColor = null;
let editingSongListsSongId = null;


/* ============================================================
   ELEMENTOS
============================================================ */

const loginScreen =
  document.getElementById("loginScreen");

const app =
  document.getElementById("app");

const loginForm =
  document.getElementById("loginForm");

const logoutBtn =
  document.getElementById("logoutBtn");

const currentUserName =
  document.getElementById("currentUserName");

const notice =
  document.getElementById("notice");


/* ============================================================
   UTILIDADES
============================================================ */

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showNotice(
  message,
  type = ""
) {

  notice.innerHTML = `
    <div class="notice ${type}">
      ${escapeHtml(message)}
    </div>
  `;

  setTimeout(() => {

    notice.innerHTML = "";

  }, 3500);
}


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
   AUTENTICACIÓN
============================================================ */

loginForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    const email =
      document.getElementById(
        "loginEmail"
      ).value.trim();

    const password =
      document.getElementById(
        "loginPassword"
      ).value;

    if (!email || !password) {
      return;
    }

    const {
      error
    } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      showNotice(
        error.message,
        "error"
      );

      return;
    }

    loginForm.reset();

  }
);


logoutBtn.addEventListener(
  "click",
  async function() {

    await supabaseClient.auth.signOut();

  }
);


async function handleAuthSession(session) {

  try {

    if (session?.user) {

      const userId =
        session.user.id;

      currentUser =
        session.user;

      loginScreen.classList.add(
        "hidden"
      );

      app.classList.remove(
        "hidden"
      );

      if (
        initializedUserId === userId ||
        initializingUserId === userId
      ) {
        return;
      }

      initializingUserId =
        userId;

      try {

        await initializeApp();

        initializedUserId =
          userId;

      } finally {

        if (
          initializingUserId === userId
        ) {
          initializingUserId =
            null;
        }

      }

    } else {

      currentUser = null;
      currentBand = null;
      currentProfile = null;
      initializedUserId = null;
      initializingUserId = null;

      app.classList.add(
        "hidden"
      );

      loginScreen.classList.remove(
        "hidden"
      );

    }

  } catch (error) {

    console.error(error);

    showNotice(
      error.message ||
      "No se pudo cargar BandaBase.",
      "error"
    );

  }

}


supabaseClient.auth.onAuthStateChange(
  function(event, session) {

    void handleAuthSession(session);

  }
);


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


/* ============================================================
   BANDA ACTUAL
============================================================ */

async function loadCurrentBand() {

  const {
    data: membership,
    error: membershipError
  } =
    await supabaseClient
      .from("band_members")
      .select(
        "band_id, role, active, display_name, tags"
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .eq(
        "active",
        true
      )
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {

    throw new Error(
      "Tu usuario no tiene acceso activo a BandaBase."
    );

  }

  const {
    data: band,
    error: bandError
  } =
    await supabaseClient
      .from("bands")
      .select("*")
      .eq(
        "id",
        membership.band_id
      )
      .single();

  if (bandError) {
    throw bandError;
  }

  currentBandRole =
    membership.role ||
    "member";

  currentBand = {
    ...band,
    membership
  };

  currentUserName.textContent =
    membership.display_name ||
    currentUser.email ||
    "Usuario";

}


/* ============================================================
   PERFIL
============================================================ */

async function loadCurrentProfile() {

  const {
    data: profile,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  currentProfile =
    profile || {};

  document.getElementById(
    "profileName"
  ).value =
    currentProfile.full_name || "";

  renderProfileInstrumentPicker(
    currentProfile.instruments
  );

  document.getElementById(
    "profileRole"
  ).value =
    currentProfile.role || "";

  updateProfileSummary();
  setProfileEditing(false);

  await loadMembers();

}


async function loadMembers() {

  const membersList =
    document.getElementById(
      "membersList"
    );

  membersList.innerHTML =
    "Cargando...";

  const {
    data: members,
    error: memberError
  } =
    await supabaseClient
      .from("band_members")
      .select(
        "user_id, role, active, display_name, tags"
      )
      .eq(
        "band_id",
        currentBand.id
      )
      .eq(
        "active",
        true
      );

  if (memberError) {
    throw memberError;
  }

  if (!members?.length) {

    membersList.innerHTML =
      `<div class="member">
        No hay integrantes.
      </div>`;

    return;
  }

  const userIds =
    members.map(
      member =>
        member.user_id
    );

  const {
    data: profiles
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "user_id, full_name, instrument, instruments, role"
      )
      .in(
        "user_id",
        userIds
      );

  bandMemberProfilesMap =
    Object.fromEntries(
      (profiles || []).map(
        profile => [
          profile.user_id,
          profile
        ]
      )
    );

  allBandMembers =
    (members || []).map(
      member => ({
        ...member,
        profile:
          bandMemberProfilesMap[
            member.user_id
          ] || {}
      })
    );

  membersList.innerHTML =
    members
      .map(member => {

        const profile =
          bandMemberProfilesMap[
            member.user_id
          ] || {};

        const name =
          member.display_name ||
          profile.full_name ||
          "Sin nombre";

        const instrument =
          formatBandInstruments(profile.instruments) ||
          profile.instrument ||
          "Sin instrumento";

        const role =
          profile.role ||
          member.role ||
          "";

        return `
          <div class="member">

            <div>

              <div class="member-name">
                ${escapeHtml(name)}
              </div>

              <div class="member-info">
                ${escapeHtml(instrument)}
                ${role
                  ? " · " + escapeHtml(role)
                  : ""}
              </div>

            </div>

          </div>
        `;

      })
      .join("");

}


function renderProfileInstrumentPicker(selected) {
  const picker = document.getElementById("profileInstrumentPicker");
  if (!picker) return;

  const values = normalizeBandInstruments(selected);
  picker.innerHTML = BAND_INSTRUMENT_OPTIONS.map(option =>
    '<label class="profile-instrument-option">' +
      '<input type="checkbox" data-profile-instrument="' + escapeHtml(option.value) + '"' +
      (values.includes(option.value) ? ' checked' : '') + '>' +
      '<span>' + option.icon + ' ' + escapeHtml(option.label) + '</span>' +
    '</label>'
  ).join("");
}

function updateProfileSummary() {

  const name =
    currentProfile.full_name ||
    "Sin nombre";

  const instrument =
    formatBandInstruments(
      currentProfile.instruments
    ) ||
    currentProfile.instrument ||
    "";

  const role =
    currentProfile.role ||
    "";

  document.getElementById(
    "resumenPerfilNombre"
  ).textContent =
    name;

  document.getElementById(
    "resumenPerfilInfo"
  ).textContent =
    [instrument, role]
      .filter(Boolean)
      .join(" · ") ||
    "Sin instrumento ni rol";

}


function setProfileEditing(isEditing) {

  const profileForm =
    document.getElementById(
      "profileForm"
    );

  const profileSummary =
    document.getElementById(
      "profileSummary"
    );

  const profileEditBtn =
    document.getElementById(
      "profileEditBtn"
    );

  if (isEditing) {

    profileSummary.classList.add(
      "hidden"
    );

    profileForm.classList.remove(
      "hidden"
    );

    profileEditBtn.textContent =
      "Cancelar";

  } else {

    profileForm.classList.add(
      "hidden"
    );

    profileSummary.classList.remove(
      "hidden"
    );

    profileEditBtn.textContent =
      "Editar perfil";

  }

}


document.getElementById(
  "profileEditBtn"
).addEventListener(
  "click",
  function() {

    const editing =
      !document
        .getElementById("profileForm")
        .classList.contains("hidden");

    if (editing) {

      document.getElementById(
        "profileName"
      ).value =
        currentProfile.full_name || "";

      renderProfileInstrumentPicker(
        currentProfile.instruments
      );

      document.getElementById(
        "profileRole"
      ).value =
        currentProfile.role || "";

      setProfileEditing(false);
      return;

    }

    document.getElementById(
      "profileName"
    ).value =
      currentProfile.full_name || "";

    renderProfileInstrumentPicker(
      currentProfile.instruments
    );

    document.getElementById(
      "profileRole"
    ).value =
      currentProfile.role || "";

    setProfileEditing(true);

    document.getElementById(
      "profileName"
    ).focus();

  }
);


document.getElementById(
  "profileForm"
).addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    if (!currentUser || !currentBand) {
      return;
    }

    const fullName =
      document.getElementById(
        "profileName"
      ).value.trim();

    const instruments =
      normalizeBandInstruments(
        Array.from(
          document.querySelectorAll(
            "#profileInstrumentPicker input[data-profile-instrument]:checked"
          )
        ).map(
          input => input.dataset.profileInstrument
        )
      );

    const instrument =
      instruments
        .map(value => getBandInstrumentOption(value)?.label)
        .filter(Boolean)
        .join(", ");

    const role =
      document.getElementById(
        "profileRole"
      ).value.trim();


    const {
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .upsert(
          {
            user_id:
              currentUser.id,
            full_name:
              fullName || null,
            instrument:
              instrument || null,
            instruments,
            role:
              role || null
          },
          {
            onConflict:
              "user_id"
          }
        );

    if (profileError) {

      showNotice(
        profileError.message,
        "error"
      );

      return;
    }


    const {
      error: memberError
    } =
      await supabaseClient
        .from("band_members")
        .update({
          display_name:
            fullName || null
        })
        .eq(
          "band_id",
          currentBand.id
        )
        .eq(
          "user_id",
          currentUser.id
        );

    if (memberError) {

      showNotice(
        memberError.message,
        "error"
      );

      return;
    }

    currentProfile = {
      ...currentProfile,
      full_name:
        fullName || null,
      instrument:
        instrument || null,
      instruments,
      role:
        role || null
    };

    currentUserName.textContent =
      fullName ||
      currentUser.email ||
      "Usuario";

    showNotice(
      "Perfil guardado.",
      "success"
    );

    setProfileEditing(false);
    updateProfileSummary();

    await loadMembers();

  }
);
