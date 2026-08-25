import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.E2E_MEDIA_TEST === "true" &&
  process.env.E2E_TEST_EMAIL &&
  process.env.E2E_TEST_PASSWORD &&
  process.env.E2E_SESSION_ID,
);

test.describe("approved exercise media", () => {
  test.skip(
    !configured,
    "Requires an authenticated test account with a plan and approved media",
  );

  test("plays inline in the workout and opens the execution sheet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 30000 });
    await page.goto(`/workout-session/${process.env.E2E_SESSION_ID}`);

    const preview = page
      .locator(
        '[data-testid="exercise-preview-gif"], [data-testid="exercise-preview-video"]',
      )
      .first();
    await expect(preview).toBeVisible();
    if (
      (await preview.getAttribute("data-testid")) === "exercise-preview-video"
    )
      await expect(preview).toHaveAttribute("playsinline", "");
    await page
      .getByRole("button", { name: "Execução", exact: true })
      .first()
      .click();

    const sheet = page.getByRole("dialog", { name: "Como fazer" });
    await expect(sheet).toBeVisible({ timeout: 15000 });
    await expect(
      sheet.locator(
        '[data-testid="exercise-preview-gif"], [data-testid="exercise-detail-video"]',
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(sheet).toBeHidden();
  });
});
