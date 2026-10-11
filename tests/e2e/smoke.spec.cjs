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
