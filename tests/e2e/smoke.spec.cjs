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


test("Materials accepts multiple files and audio chips can be reordered by dragging", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

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

  const fileInput = page.locator("#materialPendingFile");
  await expect(fileInput).toHaveAttribute("multiple", "");

  await fileInput.setInputFiles([
    { name: "01-Bajo.flac", mimeType: "audio/flac", buffer: Buffer.from("audio-one") },
    { name: "02-Bateria.flac", mimeType: "audio/flac", buffer: Buffer.from("audio-two") },
    { name: "03-Teclas.flac", mimeType: "audio/flac", buffer: Buffer.from("audio-three") }
  ]);

  const chips = page.locator("#materialComposerEditor .material-inline-attachment");
  await expect(chips).toHaveCount(3);
  expect(await chips.evaluateAll(nodes => nodes.map(node => node.querySelector(".material-inline-attachment-label")?.textContent.trim())))
    .toEqual(["♫ 01-Bajo.flac", "♫ 02-Bateria.flac", "♫ 03-Teclas.flac"]);
  await expect(chips.nth(0)).toHaveAttribute("data-material-draggable-audio", "true");
  await expect(chips.nth(0)).not.toHaveAttribute("draggable", "true");

  await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    window.__materialOriginalAudioChip = editor.querySelector(
      '[data-material-draggable-audio="true"]'
    );
    editor.appendChild(document.createElement("br"));
    const destination = document.createElement("span");
    destination.id = "dragTestDestination";
    destination.textContent = "Destino";
    editor.appendChild(destination);
  });

  const firstBox = await chips.nth(0).boundingBox();
  const destinationTextBox = await page.locator("#dragTestDestination").boundingBox();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  // First move the preview to a separate line so the remaining chips settle
  // into their real positions after the source chip leaves the original row.
  await page.mouse.move(destinationTextBox.x + 2, destinationTextBox.y + destinationTextBox.height / 2, { steps: 5 });

  const secondBox = await page.locator(
    '#materialComposerEditor [data-material-draggable-audio="true"]'
  ).nth(0).boundingBox();
  const thirdBox = await page.locator(
    '#materialComposerEditor [data-material-draggable-audio="true"]'
  ).nth(1).boundingBox();
  const betweenChipsX = (secondBox.x + secondBox.width + thirdBox.x) / 2;
  await page.mouse.move(betweenChipsX, secondBox.y + secondBox.height / 2, { steps: 8 });
  await page.mouse.up();

  const visibleOrder = await chips.evaluateAll(nodes =>
    nodes.map(node => node.querySelector(".material-inline-attachment-label")?.textContent.trim())
  );
  expect(visibleOrder).toEqual(["♫ 02-Bateria.flac", "♫ 01-Bajo.flac", "♫ 03-Teclas.flac"]);
  const sameNodeWasMoved = await page.evaluate(() =>
    document.querySelectorAll("#materialComposerEditor [data-material-draggable-audio]").length === 3 &&
    document.querySelectorAll("#materialComposerEditor [data-material-draggable-audio]")[1] ===
      window.__materialOriginalAudioChip
  );
  expect(sameNodeWasMoved).toBe(true);

  const savedOrder = await page.evaluate(() =>
    collectMaterialComposerBlocks()
      .filter(block => block.block_type === "attachment")
      .map(block => materialPendingAttachments[block.pendingKey]?.name)
  );
  expect(savedOrder).toEqual(["02-Bateria.flac", "01-Bajo.flac", "03-Teclas.flac"]);
  expect(runtimeErrors, "JavaScript errors while inserting and reordering Material attachments").toEqual([]);
});

test("native browser drag places a Material file at the caret directly under the pointer", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

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

    const editor = document.getElementById("materialComposerEditor");
    editor.style.width = "420px";
    editor.style.maxWidth = "420px";
    const file = createMaterialInlineAttachment({
      id: "native-drag-file",
      kind: "file",
      name: "Partitura.pdf",
      mime_type: "application/pdf",
      storage_path: "materials/native-drag.pdf"
    });
    const sourceLine = document.createElement("div");
    sourceLine.appendChild(file);
    const destinationLine = document.createElement("div");
    destinationLine.id = "native-drop-destination";
    destinationLine.textContent = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    editor.replaceChildren(sourceLine, destinationLine);
    window.__nativeDragFile = file;
    window.__nativeDragSourceLine = sourceLine;
    window.__nativeDragSourceHeight = sourceLine.getBoundingClientRect().height;
    window.__nativeDragEvents = { start: 0, over: 0, drop: 0 };
    editor.addEventListener("dragstart", () => window.__nativeDragEvents.start++);
    editor.addEventListener("dragover", () => window.__nativeDragEvents.over++);
    editor.addEventListener("drop", () => window.__nativeDragEvents.drop++);
    editor.focus();
  });

  const target = await page.evaluate(() => {
    const text = document.getElementById("native-drop-destination").firstChild;
    const range = document.createRange();
    range.setStart(text, 15);
    range.collapse(true);
    const caret = getMaterialRangeCaretPoint(
      range,
      document.getElementById("materialComposerEditor")
    );
    return { x: caret.x, y: caret.y };
  });
  const source = await page.locator(
    "#materialComposerEditor [data-material-draggable-attachment='true']"
  ).boundingBox();

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 24 });

  const preview = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const placeholder = editor.querySelector(".material-attachment-drop-placeholder");
    const rect = placeholder?.getBoundingClientRect();
    return {
      inEditor: Boolean(placeholder),
      left: rect?.left ?? null,
      events: window.__nativeDragEvents,
      sourceStillConnected: window.__nativeDragFile.isConnected,
      sourceIsOutOfFlow: getComputedStyle(window.__nativeDragFile).position === "fixed",
      sourceHeightBefore: window.__nativeDragSourceHeight,
      sourceHeightDuring: window.__nativeDragSourceLine.getBoundingClientRect().height
    };
  });

  expect(preview.events.start).toBeGreaterThan(0);
  expect(preview.events.over).toBeGreaterThan(0);
  expect(preview.inEditor).toBe(true);
  expect(preview.sourceStillConnected).toBe(true);
  expect(preview.sourceIsOutOfFlow).toBe(true);
  expect(Math.abs(preview.sourceHeightDuring - preview.sourceHeightBefore)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(preview.left - target.x)).toBeLessThanOrEqual(4);

  await page.mouse.up();

  const committed = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const file = window.__nativeDragFile;
    const destination = document.getElementById("native-drop-destination");
    const before = document.createRange();
    before.setStart(destination, 0);
    before.setEndBefore(file);
    const after = document.createRange();
    after.setStartAfter(file);
    after.setEnd(destination, destination.childNodes.length);
    return {
      sameNode: destination.querySelector("[data-material-draggable-attachment='true']") === file,
      textBefore: before.toString().trim(),
      textAfter: after.toString().trim(),
      noPreview: !editor.querySelector(".material-attachment-drop-placeholder"),
      noOrigin: !editor.querySelector(".material-attachment-origin-placeholder"),
      positionRestored: file.style.position === ""
    };
  });
  expect(committed).toEqual({
    sameNode: true,
    textBefore: "ABCDEFGHIJKLMNO",
    textAfter: "PQRSTUVWXYZ",
    noPreview: true,
    noOrigin: true,
    positionRestored: true
  });
  expect(runtimeErrors, "JavaScript errors during native Material file drag").toEqual([]);
});

test("native browser drag drops Material audio inside formatted wrapped text", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

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

    const editor = document.getElementById("materialComposerEditor");
    editor.style.width = "360px";
    editor.style.maxWidth = "360px";
    editor.style.boxSizing = "border-box";

    const audio = createMaterialInlineAttachment({
      id: "native-drag-audio",
      kind: "file",
      name: "Pista.flac",
      mime_type: "audio/flac",
      storage_path: "local:native-drag"
    });
    const sourceLine = document.createElement("div");
    sourceLine.appendChild(audio);
    const destinationLine = document.createElement("div");
    destinationLine.id = "native-audio-destination";
    const prefix = document.createTextNode("Texto previo al adjunto con formato: ");
    const strong = document.createElement("strong");
    strong.id = "native-audio-rich-text";
    strong.textContent = "0123456789ABCDEFGHIJKLMN";
    const suffix = document.createElement("em");
    suffix.textContent = " y texto posterior para verificar el contenido enriquecido.";
    destinationLine.append(prefix, strong, suffix);
    editor.replaceChildren(sourceLine, destinationLine);
    window.__nativeDragAudio = audio;
    window.__nativeDragSourceLine = sourceLine;
    window.__nativeDragSourceHeight = sourceLine.getBoundingClientRect().height;
    window.__nativeDragEvents = { start: 0, over: 0, drop: 0 };
    editor.addEventListener("dragstart", () => window.__nativeDragEvents.start++);
    editor.addEventListener("dragover", () => window.__nativeDragEvents.over++);
    editor.addEventListener("drop", () => window.__nativeDragEvents.drop++);
    editor.focus();
  });

  const target = await page.evaluate(() => {
    const text = document.getElementById("native-audio-rich-text").firstChild;
    const range = document.createRange();
    range.setStart(text, 14);
    range.collapse(true);
    const caret = getMaterialRangeCaretPoint(
      range,
      document.getElementById("materialComposerEditor")
    );
    return { x: caret.x, y: caret.y };
  });
  const source = await page.locator(
    "#materialComposerEditor [data-material-draggable-audio='true']"
  ).boundingBox();

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 24 });

  const preview = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const placeholder = editor.querySelector(".material-attachment-drop-placeholder");
    const rect = placeholder?.getBoundingClientRect();
    return {
      inEditor: Boolean(placeholder),
      left: rect?.left ?? null,
      events: window.__nativeDragEvents,
      sourceHeightBefore: window.__nativeDragSourceHeight,
      sourceHeightDuring: window.__nativeDragSourceLine.getBoundingClientRect().height,
      sourceStyle: window.__nativeDragAudio.getAttribute("style")
    };
  });
  expect(preview.events.start).toBeGreaterThan(0);
  expect(preview.events.over).toBeGreaterThan(0);
  expect(preview.inEditor).toBe(true);
  expect(preview.sourceStyle).toContain("position: fixed");
  expect(Math.abs(preview.sourceHeightDuring - preview.sourceHeightBefore)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(preview.left - target.x)).toBeLessThanOrEqual(4);

  await page.mouse.up();

  const committed = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const line = document.getElementById("native-audio-destination");
    const audio = window.__nativeDragAudio;
    const before = document.createRange();
    before.setStart(line, 0);
    before.setEndBefore(audio);
    const after = document.createRange();
    after.setStartAfter(audio);
    after.setEnd(line, line.childNodes.length);
    return {
      sameNode: line.querySelector("[data-material-draggable-audio='true']") === audio,
      textBefore: before.toString().trim(),
      textAfter: after.toString().trim(),
      noPreview: !editor.querySelector(".material-attachment-drop-placeholder"),
      noOrigin: !editor.querySelector(".material-attachment-origin-placeholder"),
      positionRestored: audio.style.position === ""
    };
  });
  expect(committed.sameNode).toBe(true);
  expect(committed.textBefore).toBe("Texto previo al adjunto con formato: 0123456789ABCD");
  expect(committed.textAfter).toBe("EFGHIJKLMN y texto posterior para verificar el contenido enriquecido.");
  expect(committed.noPreview).toBe(true);
  expect(committed.noOrigin).toBe(true);
  expect(committed.positionRestored).toBe(true);
  expect(runtimeErrors, "JavaScript errors during native Material audio drag").toEqual([]);
});

test("native Material drag cancelled outside the editor restores the original audio", async ({ page }) => {
  const { runtimeErrors } = await openApp(page);

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

    const editor = document.getElementById("materialComposerEditor");
    const prefix = document.createTextNode("Inicio");
    const audio = createMaterialInlineAttachment({
      id: "native-cancel-audio",
      kind: "file",
      name: "Pista.flac",
      mime_type: "audio/flac",
      storage_path: "local:native-cancel"
    });
    editor.replaceChildren(prefix, document.createTextNode(" "), audio,
      document.createTextNode(" "), document.createElement("br"),
      document.createTextNode("Destino"));
    window.__nativeCancelAudio = audio;
    window.__nativeCancelEvents = { start: 0, end: 0 };
    editor.addEventListener("dragstart", () => window.__nativeCancelEvents.start++);
    audio.addEventListener("dragend", () => window.__nativeCancelEvents.end++);
    editor.focus();
  });

  const source = await page.locator(
    "#materialComposerEditor [data-material-draggable-audio='true']"
  ).boundingBox();
  const editorBox = await page.locator("#materialComposerEditor").boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(Math.max(5, editorBox.x - 30), Math.max(5, editorBox.y - 30), { steps: 16 });
  await page.mouse.up();

  const restored = await page.evaluate(() => {
    const editor = document.getElementById("materialComposerEditor");
    const audio = window.__nativeCancelAudio;
    return {
      events: window.__nativeCancelEvents,
      sameNode: editor.querySelector("[data-material-draggable-audio='true']") === audio,
      before: audio.previousSibling?.nodeValue ?? null,
      after: audio.nextSibling?.nodeValue ?? null,
      noPreview: !editor.querySelector(".material-attachment-drop-placeholder"),
      noOrigin: !editor.querySelector(".material-attachment-origin-placeholder"),
      noFixedStyle: audio.style.position === ""
    };
  });
  expect(restored.events.start).toBeGreaterThan(0);
  expect(restored.events.end).toBeGreaterThan(0);
  expect(restored.sameNode).toBe(true);
  expect(restored.before).toBe(" ");
  expect(restored.after).toBe(" ");
  expect(restored.noPreview).toBe(true);
  expect(restored.noOrigin).toBe(true);
  expect(restored.noFixedStyle).toBe(true);
  expect(runtimeErrors, "JavaScript errors when native Material drag is cancelled").toEqual([]);
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
        '<button type="button" class="material-audio-marker" data-material-audio-marker-seconds="30">00:30</button>' +
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
  expect(result.html).toContain('<a href="https://example.com/"');
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
      paused: index !== 0,
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

    const pausedWhileLoading = [];
    wrappers.forEach((wrapper, index) => {
      wrapper.__materialAudioControls = {
        wrapper,
        player: fakePlayers[index],
        ensureAudioUrl: async () => {
          pausedWhileLoading.push(fakePlayers[index].paused);
          return true;
        },
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
    return { selected, badges, playCalls, syncedPlayers, pausedWhileLoading };
  });

  expect(result.selected.sort()).toEqual(["audio-group-original", "audio-group-split"]);
  expect(result.badges).toEqual([
    { hidden: false, text: "Grupo 2", selectedClass: true },
    { hidden: false, text: "Grupo 2", selectedClass: true }
  ]);
  expect(result.playCalls).toEqual(["audio-group-original", "audio-group-split"]);
  expect(result.pausedWhileLoading).toEqual([true, true]);
  expect(result.syncedPlayers).toEqual([
    { time: 7.123, rate: 1.25, paused: false },
    { time: 7.123, rate: 1.25, paused: false }
  ]);
  expect(runtimeErrors, "JavaScript errors while selecting and starting audio tracks").toEqual([]);
});
