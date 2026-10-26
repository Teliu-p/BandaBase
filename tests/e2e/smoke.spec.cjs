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
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0",
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


test("outdent removes indentation from every selected material line after DOM text splits", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

  const result = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    editor.replaceChildren();
    const initialText = document.createTextNode("Primera\nSegunda\nTercera");
    editor.appendChild(initialText);
    editor.focus();

    const range = document.createRange();
    range.setStart(initialText, 0);
    range.setEnd(initialText, initialText.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    rememberMaterialSelection();

    const indented = changeMaterialIndentSpaces(1);
    const afterIndent = editor.textContent;

    const outdented = changeMaterialIndentSpaces(-1);
    return {
      indented,
      outdented,
      afterIndent,
      afterOutdent: editor.textContent
    };
  });

  expect(result.indented).toBe(true);
  expect(result.afterIndent).toBe("\u00a0Primera\n\u00a0Segunda\n\u00a0Tercera");
  expect(result.outdented).toBe(true);
  expect(result.afterOutdent).toBe("Primera\nSegunda\nTercera");
  expect(runtimeErrors, "JavaScript errors in multiline outdent").toEqual([]);
});

test("Alt+1 through Alt+6 apply the six material text-format actions", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("loginScreen").classList.add("hidden");
    showMaterialForm();
    let parent = document.getElementById("materialComposerEditor");
    while (parent && parent !== document.body) {
      parent.classList?.remove("hidden");
      parent.style.display = "block";
      parent = parent.parentElement;
    }
  });

  const cases = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const results = [];

    for (const [digit, code] of [
      ["1", "Digit1"],
      ["2", "Digit2"],
      ["3", "Digit3"],
      ["4", "Digit4"],
      ["5", "Digit5"],
      ["6", "Digit6"]
    ]) {
      editor.replaceChildren(document.createTextNode("Objetivo"));
      editor.focus();
      const textNode = editor.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, textNode.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      rememberMaterialSelection();

      editor.dispatchEvent(new KeyboardEvent("keydown", {
        key: digit,
        code,
        altKey: true,
        bubbles: true,
        cancelable: true
      }));
      results.push({ digit, html: editor.innerHTML });
    }
    return results;
  });

  expect(cases[0].html).toMatch(/<(?:b|strong)\b/i);
  expect(cases[1].html).toMatch(/<(?:i|em)\b/i);
  expect(cases[2].html).toContain("(Objetivo)");
  expect(cases[3].html).toContain("[Objetivo]");
  expect(cases[4].html).toContain("material-text-size-1");
  expect(cases[5].html).toContain("material-text-size-2");
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
    await Promise.resolve();
    await Promise.resolve();
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



test("a newer login waits for an older session initialization to finish", async ({ page }) => {
  await openApp(page);

  const result = await page.evaluate(async () => {
    const originalInitializeApp = initializeApp;
    const started = [];
    let resolveA;
    let resolveB;

    initializeApp = () => new Promise(resolve => {
      const id = currentUser.id;
      started.push(id);
      if (id === "session-a") resolveA = resolve;
      if (id === "session-b") resolveB = resolve;
    });

    const first = handleAuthSession({
      user: { id: "session-a", email: "a@example.invalid" }
    });
    await Promise.resolve();
    await Promise.resolve();

    const second = handleAuthSession({
      user: { id: "session-b", email: "b@example.invalid" }
    });
    await Promise.resolve();
    await Promise.resolve();
    const whileAIsRunning = started.slice();

    resolveA();
    await first;
    await Promise.resolve();
    await Promise.resolve();
    const afterACompletes = started.slice();

    resolveB();
    await second;
    initializeApp = originalInitializeApp;

    return {
      whileAIsRunning,
      afterACompletes,
      currentUserId: currentUser?.id,
      appVisible: !document.getElementById("app").classList.contains("hidden")
    };
  });

  expect(result.whileAIsRunning).toEqual(["session-a"]);
  expect(result.afterACompletes).toEqual(["session-a", "session-b"]);
  expect(result.currentUserId).toBe("session-b");
  expect(result.appVisible).toBe(true);
});

test("logout clears state again after a previous initialization finishes", async ({ page }) => {
  await openApp(page);

  const result = await page.evaluate(async () => {
    const originalInitializeApp = initializeApp;
    let finishInitialization;
    initializeApp = () => new Promise(resolve => { finishInitialization = resolve; });

    const login = handleAuthSession({
      user: { id: "session-being-logged-out", email: "logout@example.invalid" }
    });
    await Promise.resolve();
    await Promise.resolve();

    const logout = handleAuthSession(null);
    const hiddenBeforeOldInitializationFinishes =
      document.getElementById("app").classList.contains("hidden");

    finishInitialization();
    await Promise.all([login, logout]);
    initializeApp = originalInitializeApp;

    return {
      currentUser: currentUser?.id || null,
      appHidden: document.getElementById("app").classList.contains("hidden"),
      loginVisible: !document.getElementById("loginScreen").classList.contains("hidden"),
      hiddenBeforeOldInitializationFinishes
    };
  });

  expect(result.hiddenBeforeOldInitializationFinishes).toBe(true);
  expect(result.currentUser).toBeNull();
  expect(result.appHidden).toBe(true);
  expect(result.loginVisible).toBe(true);
});

test("network rejections from auth requests show a user-facing error", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);
  const result = await page.evaluate(async () => {
    const response = await runAuthRequest(
      () => Promise.reject(new Error("Sin conexión")),
      "No se pudo iniciar sesión."
    );
    return {
      response,
      notice: document.getElementById("notice").textContent
    };
  });

  expect(result.response).toBeNull();
  expect(result.notice).toContain("Sin conexión");
  expect(runtimeErrors, "Network errors should not become unhandled runtime errors").toEqual([]);
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


test("pasting rich clipboard HTML preserves supported Materials formatting and markers", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

  const result = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    editor.replaceChildren();

    const prefix = document.createTextNode("Inicio ");
    editor.appendChild(prefix);
    editor.focus();

    const range = document.createRange();
    range.setStart(prefix, prefix.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    rememberMaterialSelection();

    const clipboard = new DataTransfer();
    clipboard.setData(
      "text/html",
      '<strong>Negrita</strong><em>Cursiva</em>' +
        '<span class="material-text-size-1">Grande</span>' +
        '<a href="https://example.com">Enlace</a>' +
        '<span class="material-notation-symbol" data-material-notation="noteQuarter" data-material-dotted="false"></span>' +
        '<span class="material-audio-marker" data-audio-marker-seconds="30">00:30</span>' +
        '<script>window.__clipboardScriptRan = true; alert("unsafe")</script>'
    );
    clipboard.setData("text/plain", "Negrita Cursiva Grande 00:30");

    const paste = new ClipboardEvent("paste", {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true
    });
    editor.dispatchEvent(paste);

    return {
      html: editor.innerHTML,
      text: editor.textContent,
      defaultPrevented: paste.defaultPrevented,
      unsafeScriptRan: Boolean(window.__clipboardScriptRan)
    };
  });

  expect(result.defaultPrevented).toBe(true);
  expect(result.html).toContain("<strong>Negrita</strong>");
  expect(result.html).toContain("<em>Cursiva</em>");
  expect(result.html).toContain("material-text-size-1");
  expect(result.html).toContain('<a href="https://example.com"');
  expect(result.html).toContain("material-notation-symbol");
  expect(result.html).toContain("material-notation-svg");
  expect(result.html).toContain('data-audio-marker-seconds="30"');
  expect(result.html).not.toContain("<script");
  expect(result.html).not.toContain("unsafe");
  expect(result.unsafeScriptRan).toBe(false);
  expect(runtimeErrors, "JavaScript errors while pasting rich clipboard content").toEqual([]);
});


test("the original comparison uses the shared Materials renderer and editor", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

  const result = await page.evaluate(() => {
    currentOriginalComparisonMaterial = {
      id: "comparison-test-material",
      type: COMPARISON_MATERIAL_TYPE,
      name: "Diferencias con la original",
      content: makeMaterialStoredText("<strong>Verso</strong> <em>original</em>"),
      attachments: [],
      blocks: [{
        block_type: "text",
        content: makeMaterialStoredText("<strong>Verso</strong> <em>original</em>")
      }]
    };

    renderOriginalComparisonMaterialView();
    const comparisonView = document.getElementById("originalComparisonMaterialView");
    const viewHtml = comparisonView.innerHTML;
    document.getElementById("editOriginalComparisonBtn").click();

    return {
      viewHtml,
      editorVisible: !document.getElementById("materialForm").classList.contains("hidden"),
      editorHtml: document.getElementById("materialComposerEditor").innerHTML,
      editingId: editingMaterialId,
      editingType: editingMaterialType
    };
  });

  expect(result.viewHtml).toContain('class="material-view-text material-rich-text"');
  expect(result.viewHtml).toContain("<strong>Verso</strong>");
  expect(result.viewHtml).toContain("<em>original</em>");
  expect(result.editorVisible).toBe(true);
  expect(result.editorHtml).toContain("<strong>Verso</strong>");
  expect(result.editorHtml).toContain("<em>original</em>");
  expect(result.editingId).toBe("comparison-test-material");
  expect(result.editingType).toBe("ComparacionOriginal");
  expect(runtimeErrors, "JavaScript errors while opening the comparison editor").toEqual([]);
});


test("right-click selects multiple Materiales audio tracks for grouped playback", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

  const result = await page.evaluate(async () => {
    clearMaterialAudioGroupSelection();

    const root = document.createElement("div");
    root.id = "grouped-audio-selection-test";
    root.innerHTML =
      renderMaterialViewBlock({
        block_type: "attachment",
        attachment: {
          id: "audio-group-original",
          kind: "file",
          name: "Original.mp3",
          mime_type: "audio/mpeg",
          storage_path: "test/original.mp3"
        }
      }) +
      renderMaterialViewBlock({
        block_type: "attachment",
        attachment: {
          id: "audio-group-split",
          kind: "file",
          name: "Guitarra.wav",
          mime_type: "audio/wav",
          storage_path: "test/guitarra.wav"
        }
      });
    document.body.appendChild(root);
    bindMaterialViewEvents(root);

    const wrappers = Array.from(root.querySelectorAll("[data-material-inline-audio]"));
    wrappers.forEach(wrapper => {
      wrapper.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true
      }));
    });

    const selected = [...materialAudioGroupSelectedIds];
    const badges = wrappers.map(wrapper => ({
      hidden: wrapper.querySelector("[data-material-audio-group-badge]").hidden,
      text: wrapper.querySelector("[data-material-audio-group-badge]").textContent,
      selectedClass: wrapper.classList.contains("is-group-selected")
    }));

    const playCalls = [];
    const fakePlayers = wrappers.map((wrapper, index) => ({
      paused: true,
      ended: false,
      readyState: 1,
      duration: 120,
      currentTime: index === 0 ? 7.1234 : 0.2,
      playbackRate: index === 0 ? 1.25 : 1,
      preservesPitch: false,
      dataset: {},
      closest: () => wrapper,
      play() {
        playCalls.push(wrapper.dataset.materialAudioId);
        this.paused = false;
        this.ended = false;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      }
    }));

    wrappers.forEach((wrapper, index) => {
      wrapper.__materialAudioControls = {
        wrapper,
        player: fakePlayers[index],
        ensureAudioUrl: async () => true,
        updateAudioUi() {}
      };
    });

    await toggleMaterialAudioGroupPlayback(wrappers[0]);
    const syncedPlayers = fakePlayers.map(player => ({
      time: player.currentTime,
      rate: player.playbackRate,
      paused: player.paused
    }));

    root.remove();
    return { selected, badges, playCalls, syncedPlayers };
  });

  expect(result.selected.sort()).toEqual(["audio-group-original", "audio-group-split"]);
  expect(result.badges).toEqual([
    { hidden: false, text: "Grupo 2", selectedClass: true },
    { hidden: false, text: "Grupo 2", selectedClass: true }
  ]);
  expect(result.playCalls).toEqual(["audio-group-original", "audio-group-split"]);
  expect(result.syncedPlayers).toEqual([
    { time: 7.123, rate: 1.25, paused: false },
    { time: 7.123, rate: 1.25, paused: false }
  ]);
  expect(runtimeErrors, "JavaScript errors while selecting and starting audio tracks").toEqual([]);
});
