import { expect, test } from "@playwright/test";
const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);
test.describe("Supabase authentication", () => {
  test.skip(!configured, "Requires local or test Supabase credentials");
  test("allowed user can sign in", async ({ page }) => {
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
    });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/today|onboarding/, { timeout: 15000 });
    const expectedAuthOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
      .origin;
    expect(authRequests.some((url) => url.includes("/auth/v1/token"))).toBe(
      true,
    );
    expect(
      authRequests.every((url) => new URL(url).origin === expectedAuthOrigin),
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

    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByLabel("Confirmar senha").fill(password!);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/onboarding/, { timeout: 15000 });

    await page.context().clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha", { exact: true }).fill(password!);
    await page.getByLabel("Confirmar senha").fill(password!);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "já possui uma conta",
    );
  });
  test("authenticated dashboard fits all release breakpoints", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 15000 });
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
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
