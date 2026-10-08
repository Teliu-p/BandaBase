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
      setTimeout(() => {
        void handleAuthSession(data.session);
      }, 0);
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

    setTimeout(() => {
      void handleAuthSession(session);
    }, 0);

  }
);
