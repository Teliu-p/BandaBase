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
      data,
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

    if (data?.session) {
      await handleAuthSession(data.session);
    }

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

      if (typeof window.bandabaseStopMetronome === "function") {
        window.bandabaseStopMetronome();
      }

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
