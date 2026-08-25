import { expect, test } from "@playwright/test";
const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);
test.describe("Supabase authentication", () => {
  test.skip(!configured, "Requires local or test Supabase credentials");
  test("allowed user can sign in", async ({ page }) => {
    const authRequests: string[] = [];
    const serverActionRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
      if (request.method() === "POST" && request.headers()["next-action"])
        serverActionRequests.push(request.url());
    });
    await page.route(/\/auth\/v1\//, (route) => route.abort("blockedbyclient"));
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/today|onboarding/, { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    expect(authRequests).toHaveLength(0);
    expect(serverActionRequests.length).toBeGreaterThan(0);
    const cookies = await page.context().cookies();
    expect(
      cookies.some((cookie) => cookie.name.startsWith("vm-training-auth")),
    ).toBe(true);
  });
  test("unlisted email signup is rejected by server hook", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill("qualqueroutro@gmail.com");
    await page.getByLabel("Senha", { exact: true }).fill("SenhaForaDaLista12");
    await page.getByLabel("Confirmar senha").fill("SenhaForaDaLista12");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "não está autorizado",
    );
    await expect(
      page.getByRole("button", { name: "Criar conta" }),
    ).toBeEnabled();
  });
  test("weak signup password is rejected before Auth", async ({ page }) => {
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
    });
    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill("weak-password@example.test");
    await page.getByLabel("Senha", { exact: true }).fill("Fraca1");
    await page.getByLabel("Confirmar senha").fill("Fraca1");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "Use ao menos 12 caracteres",
    );
    expect(authRequests).toHaveLength(0);
  });
  test("allowlisted signup creates a session and repeat signup is mapped", async ({
    page,
  }, testInfo) => {
    const suffix = testInfo.project.name.toUpperCase();
    const email = process.env[`E2E_SIGNUP_EMAIL_${suffix}`];
    const password = process.env.E2E_SIGNUP_PASSWORD;
    test.skip(!email || !password, "Requires disposable local signup data");

    const authRequests: string[] = [];
    const serverActionRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
      if (request.method() === "POST" && request.headers()["next-action"])
        serverActionRequests.push(request.url());
    });
    await page.route(/\/auth\/v1\//, (route) => route.abort("blockedbyclient"));

    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByLabel("Confirmar senha").fill(password!);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/onboarding/, { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    expect(authRequests).toHaveLength(0);
    expect(serverActionRequests.length).toBeGreaterThan(0);
    const cookies = await page.context().cookies();
    expect(
      cookies.some((cookie) => cookie.name.startsWith("vm-training-auth")),
    ).toBe(true);

    await page.context().clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByLabel("Confirmar senha").fill(password!);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "já possui uma conta",
    );
    await expect(
      page.getByRole("button", { name: "Criar conta" }),
    ).toBeEnabled();
  });
  test("authenticated dashboard fits all release breakpoints", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    for (const [width, height] of [
      [375, 812],
      [390, 844],
      [430, 932],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/today");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow, `authenticated overflow at ${width}px`).toBe(false);
    }
  });
});
