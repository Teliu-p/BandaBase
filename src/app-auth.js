/* ============================================================
   AUTENTICACIÓN
============================================================ */

async function runAuthRequest(request, fallbackMessage) {
  try {
    return await request();
  } catch (error) {
    showNotice(
      error?.message || fallbackMessage,
      "error"
    );
    return null;
  }
}

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

    const response = await runAuthRequest(
      () => supabaseClient.auth.signInWithPassword({
        email,
        password
      }),
      "No se pudo iniciar sesión. Revisá tu conexión e intentá de nuevo."
    );
    if (!response) return;

    const { data, error } = response;

    if (error) {

      showNotice(
        error.message,
        "error"
      );

      return;
    }

    loginForm.reset();

    if (data?.session) {
      await handleAuthSession(data.session);
    }

  }
);


/* ============================================================
   REGISTRO DE NUEVOS INTEGRANTES
============================================================ */

signupForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    const fullName =
      document.getElementById("signupName").value.trim();

    const email =
      document.getElementById("signupEmail").value.trim();

    const password =
      document.getElementById("signupPassword").value;

    const passwordConfirm =
      document.getElementById("signupPasswordConfirm").value;

    if (!fullName || !email || !password || !passwordConfirm) {
      return;
    }

    if (password.length < 8) {
      showNotice(
        "La contraseña debe tener al menos 8 caracteres.",
        "error"
      );
      return;
    }

    if (password !== passwordConfirm) {
      showNotice(
        "Las contraseñas no coinciden.",
        "error"
      );
      return;
    }

    const response = await runAuthRequest(
      () => supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      }),
      "No se pudo crear la cuenta. Revisá tu conexión e intentá de nuevo."
    );
    if (!response) return;

    const { data, error } = response;

    if (error) {
      showNotice(
        error.message || "No se pudo crear la cuenta.",
        "error"
      );
      return;
    }

    signupForm.reset();

    if (data?.session) {
      await handleAuthSession(data.session);
      return;
    }

    showNotice(
      "Cuenta creada. Revisá tu correo y confirmá la dirección para poder iniciar sesión.",
      "success"
    );

  }
);


logoutBtn.addEventListener(
  "click",
  async function() {
    const response = await runAuthRequest(
      () => supabaseClient.auth.signOut(),
      "No se pudo cerrar la sesión. Intentá de nuevo."
    );

    if (response?.error) {
      showNotice(response.error.message, "error");
    }
  }
);


let authTransitionVersion = 0;

function clearBandabaseSessionData() {
  currentUser = null;
  currentBand = null;
  currentProfile = null;
  currentBandRole = "member";
  initializedUserId = null;

  allSongs = [];
  songSingersMap = {};
  allBandMembers = [];
  bandMemberProfilesMap = {};
  currentSong = null;
  currentMaterials = [];
  currentOriginalComparisonMaterial = null;
  currentBandLists = [];
  bandListItemsMap = {};
  bandListManagersMap = {};
  currentBandList = null;
  selectedNewSongColor = null;
  selectedDetailSongColor = null;
  editingSongListsSongId = null;
  navigationInitialized = false;

  if (typeof currentComments !== "undefined") currentComments = [];
  if (typeof commentProfilesMap !== "undefined") commentProfilesMap = {};
  if (typeof generalComments !== "undefined") generalComments = [];
  if (typeof generalCommentProfilesMap !== "undefined") generalCommentProfilesMap = {};
  if (typeof generalEditingCommentId !== "undefined") generalEditingCommentId = null;
  if (typeof editingCommentId !== "undefined") editingCommentId = null;
  if (typeof currentProposals !== "undefined") currentProposals = [];
  if (typeof proposalOptionsMap !== "undefined") proposalOptionsMap = {};
  if (typeof proposalVotesMap !== "undefined") proposalVotesMap = {};
  if (typeof proposalVoteStatsMap !== "undefined") proposalVoteStatsMap = {};
  if (typeof proposalProfilesMap !== "undefined") proposalProfilesMap = {};
  if (typeof proposalAttachmentsMap !== "undefined") proposalAttachmentsMap = {};
  if (typeof proposalBlocksMap !== "undefined") proposalBlocksMap = {};
  if (typeof proposalPendingAttachments !== "undefined") proposalPendingAttachments = {};
  if (typeof openMaterialIds !== "undefined") openMaterialIds = new Set();
  if (typeof materialPendingAttachments !== "undefined") materialPendingAttachments = {};
  if (typeof materialSelectionRange !== "undefined") materialSelectionRange = null;
  if (typeof materialDraftInitialAttachmentIds !== "undefined") {
    materialDraftInitialAttachmentIds = new Set();
  }
  if (typeof editingMaterialId !== "undefined") editingMaterialId = null;
  if (typeof editingBandListId !== "undefined") editingBandListId = null;

  document.querySelectorAll("#app audio, #app video").forEach(media => {
    try {
      media.pause();
      media.removeAttribute("src");
      media.load();
    } catch (error) {
      console.warn("No se pudo detener un medio al cambiar de sesión.", error);
    }
  });

  for (const id of [
    "materialsList",
    "commentsList",
    "generalCommentsList",
    "recentCommentsList",
    "proposalsList",
    "recentListsPreview",
    "recentProposalsPreview",
    "membersList"
  ]) {
    document.getElementById(id)?.replaceChildren();
  }

  document.getElementById("songDetail")?.classList.add("hidden");
  document.getElementById("songsBrowser")?.classList.remove("hidden");
  document.getElementById("createSongCard")?.classList.remove("hidden");
  document.getElementById("listDetail")?.classList.add("hidden");
  document.getElementById("listsBrowser")?.classList.remove("hidden");

  for (const reset of [
    typeof hideMaterialForm === "function" ? hideMaterialForm : null,
    typeof resetCommentForm === "function" ? resetCommentForm : null,
    typeof resetGeneralCommentForm === "function" ? resetGeneralCommentForm : null,
    typeof resetProposalForm === "function" ? resetProposalForm : null,
    typeof hideBandListForm === "function" ? hideBandListForm : null
  ]) {
    if (reset) {
      try {
        reset();
      } catch (error) {
        console.warn("No se pudo restablecer un formulario al cambiar de sesión.", error);
      }
    }
  }
}


let authInitializationPromise = null;

async function handleAuthSession(session) {
  if (session?.user) {
    const userId = session.user.id;

    if (initializedUserId === userId) {
      currentUser = session.user;
      loginScreen.classList.add("hidden");
      app.classList.remove("hidden");
      return;
    }

    if (
      initializingUserId === userId &&
      currentUser?.id === userId
    ) {
      return;
    }

    const transitionVersion = ++authTransitionVersion;

    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    clearBandabaseSessionData();
    currentUser = session.user;

    try {
      // Never run two initializeApp() calls concurrently. An older session's
      // requests may still be finishing; wait for them, discard their state,
      // and only then load the latest session.
      while (authInitializationPromise) {
        const pendingInitialization = authInitializationPromise;
        try {
          await pendingInitialization;
        } catch {
          // The active transition owns the error notification.
        }

        if (
          transitionVersion !== authTransitionVersion ||
          currentUser?.id !== userId
        ) {
          return;
        }
      }

      clearBandabaseSessionData();
      currentUser = session.user;
      initializingUserId = userId;

      const initialization = Promise.resolve().then(
        () => initializeApp()
      );
      authInitializationPromise = initialization;

      try {
        await initialization;
      } finally {
        if (authInitializationPromise === initialization) {
          authInitializationPromise = null;
        }
        if (initializingUserId === userId) {
          initializingUserId = null;
        }
      }

      if (
        transitionVersion !== authTransitionVersion ||
        currentUser?.id !== userId
      ) {
        return;
      }

      initializedUserId = userId;
      loginScreen.classList.add("hidden");
      app.classList.remove("hidden");
    } catch (error) {
      if (transitionVersion !== authTransitionVersion) {
        return;
      }

      console.error(error);
      clearBandabaseSessionData();
      initializingUserId = null;
      app.classList.add("hidden");
      loginScreen.classList.remove("hidden");

      showNotice(
        error.message ||
        "No se pudo cargar BandaBase.",
        "error"
      );
    }
  } else {
    const logoutTransition = ++authTransitionVersion;

    if (typeof window.bandabaseStopMetronome === "function") {
      window.bandabaseStopMetronome();
    }

    clearBandabaseSessionData();
    initializingUserId = null;
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    // An in-flight initializer may still finish mutating shared module state.
    // Wait for it and clear once more, unless a newer login/logout superseded us.
    const pendingInitialization = authInitializationPromise;
    if (pendingInitialization) {
      try {
        await pendingInitialization;
      } catch {
        // Session has already been cleared; no stale error toast is useful.
      }
    }

    if (logoutTransition !== authTransitionVersion) {
      return;
    }

    clearBandabaseSessionData();
    initializingUserId = null;
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
}

supabaseClient.auth.onAuthStateChange(
  function(event, session) {

    if (event === "INITIAL_SESSION") {
      return;
    }

    setTimeout(() => {
      void handleAuthSession(session);
    }, 0);

  }
);


(async function initializeAuthentication() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    await handleAuthSession(
      data?.session || null
    );

  } catch (error) {

    console.error(error);

    showNotice(
      error.message ||
      "No se pudo recuperar la sesión.",
      "error"
    );

  }

})();
