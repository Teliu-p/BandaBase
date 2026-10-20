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
