import { expect, test } from "@playwright/test";
const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);
test.describe("Supabase authentication", () => {
  test.skip(!configured, "Requires local or test Supabase credentials");
  test("allowed user can sign in", async ({ page }) => {
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/"))
        authRequests.push(request.url());
    });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/today|onboarding/);
    expect(authRequests.some((url) => url.includes("/supabase/auth/v1/token"))).toBe(
      true,
    );
    expect(
      authRequests.every(
        (url) => new URL(url).origin === new URL(page.url()).origin,
      ),
    ).toBe(true);
  });
  test("unlisted email signup is rejected by server hook", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("E-mail").fill("qualqueroutro@gmail.com");
    await page.getByLabel("Senha", { exact: true }).fill("uma-senha-segura");
    await page.getByLabel("Confirmar senha").fill("uma-senha-segura");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "não está autorizado",
    );
  });
  test("authenticated dashboard fits all release breakpoints", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/);
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
