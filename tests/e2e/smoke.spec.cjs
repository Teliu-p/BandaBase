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

test("dragging any Material file follows the pointer and previews its exact inline position", async ({ page }) => {
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
    const attachment = createMaterialInlineAttachment({
      id: "live-preview-file",
      kind: "file",
      name: "Partitura.pdf",
      mime_type: "application/pdf",
      storage_path: "materials/live-preview.pdf"
    });
    const destination = document.createElement("span");
    destination.id = "live-preview-destination";
    destination.textContent = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    editor.replaceChildren(
      attachment,
      document.createElement("br"),
      destination
    );
    window.__livePreviewFile = attachment;
    window.__livePreviewSamples = [];
    document.addEventListener("pointermove", event => {
      const preview = document.querySelector(".material-attachment-drop-placeholder");
      const ghost = document.querySelector(".material-attachment-drag-ghost");
      if (preview?.isConnected && ghost?.isConnected) {
        const previewRect = preview.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        window.__livePreviewSamples.push({
          left: Math.round(previewRect.left),
          top: Math.round(previewRect.top),
          ghostCenterX: ghostRect.left + ghostRect.width / 2,
          ghostCenterY: ghostRect.top + ghostRect.height / 2,
          pointerX: event.clientX,
          pointerY: event.clientY
        });
      }
    });
    editor.focus();
  });

  const targetPoint = await page.evaluate(() => {
    const text = document.getElementById("live-preview-destination").firstChild;
    const range = document.createRange();
    range.setStart(text, 15);
    range.setEnd(text, 16);
    const rect = range.getBoundingClientRect();
    window.__livePreviewTargetX = rect.right;
    return { x: rect.right, y: rect.top + rect.height / 2 };
  });
  const source = await page.locator(
    "#materialComposerEditor [data-material-draggable-attachment='true']"
  ).boundingBox();
  const destinationLine = await page.locator("#live-preview-destination").boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    destinationLine.x + 2,
    destinationLine.y + destinationLine.height / 2,
    { steps: 8 }
  );
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });

  const livePreview = await page.evaluate(() => {
    const file = window.__livePreviewFile;
    const editor = document.getElementById("materialComposerEditor");
    const placeholder = editor.querySelector(".material-attachment-drop-placeholder");
    const ghost = document.querySelector(".material-attachment-drag-ghost");
    const nextText = (() => {
      let node = placeholder?.nextSibling;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return node;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR" &&
            node.textContent?.trim()) return node.firstChild;
        node = node.nextSibling;
      }
      return null;
    })();
    const nextChar = nextText?.nodeType === Node.TEXT_NODE
      ? [...(nextText.nodeValue || "")].findIndex(char => !/\s/.test(char))
      : -1;
    let nextCharLeft = null;
    if (nextText?.nodeType === Node.TEXT_NODE && nextChar >= 0) {
      const range = document.createRange();
      range.setStart(nextText, nextChar);
      range.setEnd(nextText, nextChar + 1);
      nextCharLeft = range.getBoundingClientRect().left;
    }
    const rect = placeholder?.getBoundingClientRect();
    const ghostRect = ghost?.getBoundingClientRect();
    const positions = [...new Set(window.__livePreviewSamples.map(
      point => point.left + ":" + point.top
    ))];
    const lastSample = window.__livePreviewSamples.at(-1);
    return {
      previewIsInEditor: Boolean(placeholder && editor.contains(placeholder)),
      realFileIsHeldOutsideEditor: !file.isConnected,
      highlighted: placeholder?.classList.contains("material-attachment-drop-placeholder"),
      width: rect?.width || 0,
      left: rect?.left ?? null,
      right: rect?.right ?? null,
      targetX: window.__livePreviewTargetX,
      nextCharLeft,
      positions,
      ghostFollowsPointer: Boolean(lastSample && ghostRect &&
        Math.abs((ghostRect.left + ghostRect.width / 2) - lastSample.pointerX) < 2 &&
        Math.abs((ghostRect.top + ghostRect.height / 2) - lastSample.pointerY) < 2),
      originMarkerPresent: Boolean(editor.querySelector(".material-attachment-origin-placeholder"))
    };
  });

  expect(livePreview.previewIsInEditor).toBe(true);
  expect(livePreview.realFileIsHeldOutsideEditor).toBe(true);
  expect(livePreview.highlighted).toBe(true);
  expect(livePreview.width).toBeGreaterThan(20);
  // The shaded slot must start at the horizontal caret under the mouse,
  // never jump back to the beginning of the visual line.
  expect(Math.abs(livePreview.left - livePreview.targetX)).toBeLessThanOrEqual(2);
  expect(livePreview.nextCharLeft).not.toBeNull();
  expect(livePreview.nextCharLeft).toBeGreaterThanOrEqual(livePreview.right);
  expect(livePreview.positions.length).toBeGreaterThan(1);
  expect(livePreview.ghostFollowsPointer).toBe(true);
  expect(livePreview.originMarkerPresent).toBe(true);

  await page.mouse.up();

  const committed = await page.evaluate(() => {
    const file = window.__livePreviewFile;
    const editor = document.getElementById("materialComposerEditor");
    const nearestNonWhitespaceText = (node, direction) => {
      while (node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return node.nodeValue.trim();
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR" &&
            node.textContent?.trim()) return node.textContent.trim();
        node = node[direction];
      }
      return "";
    };
    return {
      sameNode: editor.querySelectorAll("[data-material-draggable-attachment='true']").length === 1 &&
        editor.querySelector("[data-material-draggable-attachment='true']") === file,
      connected: file.isConnected,
      originMarkerRemoved: !editor.querySelector(".material-attachment-origin-placeholder"),
      previewRemoved: !editor.querySelector(".material-attachment-drop-placeholder"),
      ghostRemoved: !document.querySelector(".material-attachment-drag-ghost"),
      textBefore: nearestNonWhitespaceText(file.previousSibling, "previousSibling"),
      textAfter: nearestNonWhitespaceText(file.nextSibling, "nextSibling")
    };
  });
  expect(committed.sameNode).toBe(true);
  expect(committed.connected).toBe(true);
  expect(committed.originMarkerRemoved).toBe(true);
  expect(committed.previewRemoved).toBe(true);
  expect(committed.ghostRemoved).toBe(true);
  expect(committed.textBefore).toBe("ABCDEFGHIJKLMNOP");
  expect(committed.textAfter).toBe("QRSTUVWXYZ");
  expect(runtimeErrors, "JavaScript errors while dragging and committing a non-audio Material file").toEqual([]);
});

test("dragging a Material audio follows the pointer even when the native caret reports the line start", async ({ page }) => {
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
      id: "pointer-drop-audio",
      kind: "file",
      name: "Pista.flac",
      mime_type: "audio/flac",
      storage_path: "local:pointer-drop"
    });
    const sourceLine = document.createElement("div");
    sourceLine.appendChild(audio);

    const destinationLine = document.createElement("div");
    destinationLine.id = "pointer-drop-line";
    const prefix = document.createTextNode("Texto previo al adjunto con formato: ");
    const strong = document.createElement("strong");
    strong.id = "pointer-drop-rich-text";
    strong.textContent = "0123456789ABCDEFGHIJKLMN";
    const suffix = document.createElement("em");
    suffix.textContent = " y texto posterior para verificar el contenido enriquecido.";
    destinationLine.append(prefix, strong, suffix);

    editor.replaceChildren(sourceLine, destinationLine);
    window.__pointerDropAudio = audio;
    window.__pointerDropPrefix = prefix;
    window.__pointerDropRichText = strong.firstChild;
    window.__pointerDropLine = destinationLine;
    window.__pointerDropSourceLine = sourceLine;
    window.__pointerDropSourceLineHeightBefore = sourceLine.getBoundingClientRect().height;
    editor.focus();

    // Reproduce el fallo que no detectaba el test anterior: el navegador
    // responde con un caret válido dentro del editor, pero al inicio del texto,
    // aunque el puntero esté mucho más a la derecha.
    const wrongCaret = document.createRange();
    wrongCaret.setStart(prefix, 0);
    wrongCaret.collapse(true);
    Object.defineProperty(document, "caretPositionFromPoint", {
      configurable: true,
      value: () => ({ offsetNode: prefix, offset: 0 })
    });
    Object.defineProperty(document, "caretRangeFromPoint", {
      configurable: true,
      value: () => wrongCaret.cloneRange()
    });
  });

  const target = await page.evaluate(() => {
    const text = window.__pointerDropRichText;
    // Measure the collapsed insertion caret itself, not the painted edge
    // of a glyph (which excludes its typographic side bearing/letter spacing).
    const caretRange = document.createRange();
    caretRange.setStart(text, 14);
    caretRange.collapse(true);
    const caret = getMaterialRangeCaretPoint(
      caretRange,
      document.getElementById("materialComposerEditor")
    );
    const charRange = document.createRange();
    charRange.setStart(text, 14);
    charRange.setEnd(text, 15);
    const rect = charRange.getBoundingClientRect();
    const firstChar = document.createRange();
    firstChar.setStart(window.__pointerDropPrefix, 0);
    firstChar.setEnd(window.__pointerDropPrefix, 1);
    const firstRect = firstChar.getBoundingClientRect();
    window.__pointerDropExpectedX = caret.x;
    return {
      x: caret.x,
      y: rect.top + rect.height / 2,
      targetY: rect.top,
      firstY: firstRect.top,
      firstLineX: firstRect.left
    };
  });
  expect(target.targetY).toBeGreaterThan(target.firstY + 5);
  const editorBox = await page.locator("#materialComposerEditor").boundingBox();
  expect(target.x).toBeGreaterThan(editorBox.x + 20);
  const source = await page.locator(
    "#materialComposerEditor [data-material-draggable-audio='true']"
  ).boundingBox();

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 16 });

  const preview = await page.evaluate(() => {
    const placeholder = document.querySelector(".material-attachment-drop-placeholder");
    const rect = placeholder?.getBoundingClientRect();
    const editor = document.getElementById("materialComposerEditor");
    const sourceMarker = editor.querySelector(".material-attachment-origin-placeholder");
    return {
      inEditor: Boolean(placeholder && editor.contains(placeholder)),
      left: rect?.left ?? null,
      expectedX: window.__pointerDropExpectedX,
      previousText: placeholder?.previousSibling?.nodeValue ?? null,
      nextText: placeholder?.nextSibling?.nodeValue ?? null,
      sourceLineHeightBefore: window.__pointerDropSourceLineHeightBefore,
      sourceLineHeightDuring: window.__pointerDropSourceLine?.getBoundingClientRect().height ?? null,
      sourceMarkerVisibility: sourceMarker ? getComputedStyle(sourceMarker).visibility : null
    };
  });
  expect(preview.inEditor).toBe(true);
  expect(preview.sourceMarkerVisibility).toBe("hidden");
  expect(Math.abs(preview.sourceLineHeightDuring - preview.sourceLineHeightBefore)).toBeLessThanOrEqual(0.5);
  expect(preview.previousText).toBe("0123456789ABCD");
  expect(preview.nextText).toBe("EFGHIJKLMN");
  expect(Math.abs(preview.left - preview.expectedX)).toBeLessThanOrEqual(2);

  await page.mouse.up();

  const committed = await page.evaluate(() => {
    const line = window.__pointerDropLine;
    const audio = window.__pointerDropAudio;
    const before = document.createRange();
    before.setStart(line, 0);
    before.setEndBefore(audio);
    const after = document.createRange();
    after.setStartAfter(audio);
    after.setEnd(line, line.childNodes.length);
    return {
      sameNode: line.querySelector("[data-material-draggable-audio='true']") === audio,
      before: before.toString().trim(),
      after: after.toString().trim()
    };
  });
  expect(committed.sameNode).toBe(true);
  expect(committed.before).toBe("Texto previo al adjunto con formato: 0123456789ABCD");
  expect(committed.after).toBe("EFGHIJKLMN y texto posterior para verificar el contenido enriquecido.");
  expect(runtimeErrors, "JavaScript errors while dropping audio at the measured pointer position").toEqual([]);
});

test("cancelling a live Material audio drag restores the original inline position", async ({ page }) => {
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
      id: "cancel-preview-audio",
      kind: "file",
      name: "Pista.flac",
      mime_type: "audio/flac",
      storage_path: "local:cancel-preview"
    });
    editor.replaceChildren(prefix, document.createTextNode(" "), audio,
      document.createTextNode(" "), document.createElement("br"),
      document.createTextNode("Destino"));
    window.__cancelPreviewAudio = audio;
    editor.focus();
  });

  const source = await page.locator("#materialComposerEditor [data-material-draggable-attachment='true']").boundingBox();
  const destination = await page.locator("#materialComposerEditor").boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width - 20, destination.y + 8, { steps: 5 });
  await page.evaluate(() => {
    const pointerId = materialAttachmentPointerDragState?.pointerId;
    document.dispatchEvent(new PointerEvent("pointercancel", {
      pointerId,
      bubbles: true,
      cancelable: true
    }));
  });

  const restored = await page.evaluate(() => {
    const audio = window.__cancelPreviewAudio;
    const editor = document.getElementById("materialComposerEditor");
    const nearestNonWhitespaceText = (node, direction) => {
      while (node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return node.nodeValue;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR" &&
            node.textContent?.trim()) return node.textContent;
        node = node[direction];
      }
      return null;
    };
    return {
      sameNode: editor.querySelectorAll("[data-material-draggable-attachment='true']").length === 1 &&
        editor.querySelector("[data-material-draggable-attachment='true']") === audio,
      before: nearestNonWhitespaceText(audio.previousSibling, "previousSibling"),
      after: nearestNonWhitespaceText(audio.nextSibling, "nextSibling"),
      markerRemoved: !editor.querySelector(".material-attachment-origin-placeholder"),
      previewRemoved: !editor.querySelector(".material-attachment-drop-placeholder"),
      highlightRemoved: !audio.classList.contains("is-dragging")
    };
  });
  expect(restored).toEqual({
    sameNode: true,
    before: "Inicio",
    after: "Destino",
    markerRemoved: true,
    previewRemoved: true,
    highlightRemoved: true
  });
  expect(runtimeErrors, "JavaScript errors while cancelling a Material audio drag").toEqual([]);
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
