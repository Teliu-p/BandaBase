const { test, expect } = require("@playwright/test");

const AUTH_STUB = `
window.__bbAuthStubCalls = { signUp: 0, signIn: 0, signOut: 0 };
window.supabase = {
  createClient() {
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
        signInWithPassword: async () => {
          window.__bbAuthStubCalls.signIn += 1;
          return { data: { session: null }, error: { message: "Error de prueba" } };
        },
        signUp: async () => {
          window.__bbAuthStubCalls.signUp += 1;
          return { data: { session: null }, error: null };
        },
        signOut: async () => {
          window.__bbAuthStubCalls.signOut += 1;
          return { error: null };
        }
      }
    };
  }
};
`;

async function openApp(page) {
  await page.route(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    route => route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: AUTH_STUB
    })
  );

  const runtimeErrors = [];
  const brokenAssets = [];

  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      /\.(?:js|css)$/.test(url.pathname) &&
      response.status() >= 400
    ) {
      brokenAssets.push(`${response.status()} ${url.pathname}`);
    }
  });

  await page.goto("/");
  await expect(page.locator("#loginForm")).toBeVisible();

  return { runtimeErrors, brokenAssets };
}

test("the app boots in Chromium with no runtime errors or missing local JS/CSS", async ({ page }) => {
  const { runtimeErrors, brokenAssets } = await openApp(page);

  await expect(page).toHaveTitle(/BandaBase/);
  await expect(page.getByRole("heading", { name: "BandaBase", exact: true })).toBeVisible();
  await expect(page.locator("#signupForm")).toBeVisible();
  await expect(page.locator("#app")).toBeHidden();

  expect(runtimeErrors, "JavaScript errors during page boot").toEqual([]);
  expect(brokenAssets, "Local JavaScript or CSS responses with HTTP errors").toEqual([]);
});

test("musical notation toolbar renders portable SVG icons", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

  const notationButtonIds = [
    "materialNoteSixteenthBtn",
    "materialNoteEighthBtn",
    "materialNoteQuarterBtn",
    "materialNoteHalfBtn",
    "materialNoteWholeBtn",
    "materialRestSixteenthBtn",
    "materialRestEighthBtn",
    "materialRestQuarterBtn",
    "materialRestHalfBtn",
    "materialRestWholeBtn"
  ];

  for (const id of notationButtonIds) {
    await expect(
      page.locator("#" + id + " svg.material-notation-svg"),
      id + " should render a vector icon without depending on a music font"
    ).toHaveCount(1);
  }

  expect(runtimeErrors, "JavaScript errors while drawing musical notation").toEqual([]);
});


test("late materials and comments responses cannot overwrite the newly selected song", async ({ page }) => {
  await openApp(page);

  const materialResult = await page.evaluate(async () => {
    const originalGetMaterials = getMaterialsBySongId;
    const originalGetAttachments = getMaterialAttachments;
    const originalGetBlocks = getMaterialBlocksByMaterialIds;
    const originalRenderMaterials = renderMaterials;
    let resolveOldMaterialQuery;

    getMaterialsBySongId = (_client, songId) => {
      if (songId === "song-old") {
        return new Promise(resolve => { resolveOldMaterialQuery = resolve; });
      }
      return Promise.resolve({
        data: [{ id: "material-new", type: "Texto", name: "Nuevo", content: "Nuevo" }],
        error: null
      });
    };
    getMaterialAttachments = async () => ({ data: [], error: null });
    getMaterialBlocksByMaterialIds = async () => ({ data: [], error: null });
    renderMaterials = () => {};

    currentSong = { id: "song-old" };
    openMaterialIds = new Set();
    const oldLoad = loadMaterials();
    currentSong = { id: "song-new" };
    await loadMaterials();
    const afterNew = currentMaterials.map(material => material.id);

    resolveOldMaterialQuery({
      data: [{ id: "material-old", type: "Texto", name: "Anterior", content: "Anterior" }],
      error: null
    });
    await oldLoad;
    const finalIds = currentMaterials.map(material => material.id);

    getMaterialsBySongId = originalGetMaterials;
    getMaterialAttachments = originalGetAttachments;
    getMaterialBlocksByMaterialIds = originalGetBlocks;
    renderMaterials = originalRenderMaterials;
    return { afterNew, finalIds };
  });

  expect(materialResult.afterNew).toEqual(["material-new"]);
  expect(materialResult.finalIds).toEqual(["material-new"]);

  const commentResult = await page.evaluate(async () => {
    const originalGetComments = getCommentsBySongId;
    const originalFetchCommentData = fetchCommentData;
    const originalRenderComments = renderComments;
    let resolveOldCommentQuery;

    getCommentsBySongId = (_client, songId) => {
      if (songId === "song-old") {
        return new Promise(resolve => { resolveOldCommentQuery = resolve; });
      }
      return Promise.resolve({
        data: [{ id: "comment-new", user_id: null }],
        error: null
      });
    };
    fetchCommentData = async rows => rows;
    renderComments = () => {};

    currentSong = { id: "song-old" };
    const oldLoad = loadComments();
    currentSong = { id: "song-new" };
    await loadComments();
    const afterNew = currentComments.map(comment => comment.id);

    resolveOldCommentQuery({
      data: [{ id: "comment-old", user_id: null }],
      error: null
    });
    await oldLoad;
    const finalIds = currentComments.map(comment => comment.id);

    getCommentsBySongId = originalGetComments;
    fetchCommentData = originalFetchCommentData;
    renderComments = originalRenderComments;
    return { afterNew, finalIds };
  });

  expect(commentResult.afterNew).toEqual(["comment-new"]);
  expect(commentResult.finalIds).toEqual(["comment-new"]);
});

test("the previous account's app data stays hidden until the next account initializes", async ({ page }) => {
  await openApp(page);

  const state = await page.evaluate(async () => {
    const originalInitializeApp = initializeApp;
    let completeInitialization;
    initializeApp = () => new Promise(resolve => { completeInitialization = resolve; });

    const pending = handleAuthSession({
      user: { id: "session-user", email: "session@example.invalid" }
    });
    const during = {
      appHidden: document.getElementById("app").classList.contains("hidden"),
      loginVisible: !document.getElementById("loginScreen").classList.contains("hidden")
    };

    completeInitialization();
    await pending;
    initializeApp = originalInitializeApp;

    return {
      during,
      after: {
        appVisible: !document.getElementById("app").classList.contains("hidden"),
        loginHidden: document.getElementById("loginScreen").classList.contains("hidden")
      }
    };
  });

  expect(state.during.appHidden).toBe(true);
  expect(state.during.loginVisible).toBe(true);
  expect(state.after.appVisible).toBe(true);
  expect(state.after.loginHidden).toBe(true);
});

test("password mismatch is rejected before an auth request is made", async ({ page }) => {
  await openApp(page);

  await page.locator("#signupName").fill("Integrante de prueba");
  await page.locator("#signupEmail").fill("smoke-test@example.invalid");
  await page.locator("#signupPassword").fill("correct-horse-1");
  await page.locator("#signupPasswordConfirm").fill("different-horse-2");
  await page.getByRole("button", { name: "Crear cuenta e ingresar" }).click();

  await expect(page.locator("#notice")).toContainText(/Las contraseñas no coinciden/i);
  await expect.poll(() => page.evaluate(() => window.__bbAuthStubCalls.signUp)).toBe(0);
});

test("the login form remains within a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);

  for (const selector of ["#loginEmail", "#loginPassword", "#signupName", "#signupEmail"]) {
    const locator = page.locator(selector);
    await expect(locator).toBeVisible();
    const bounds = await locator.boundingBox();
    expect(bounds, `Expected a layout box for ${selector}`).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(376);
  }
});
