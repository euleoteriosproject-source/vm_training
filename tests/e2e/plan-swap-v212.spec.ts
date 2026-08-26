import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

const candidate = {
  exerciseId: "11111111-1111-4111-8111-111111111111",
  exerciseName: "Supino com barra",
  movementPattern: "horizontal_push",
  trainingRole: "horizontal_push",
  category: "strength",
  difficulty: "beginner",
  primaryMuscles: ["peitoral"],
  secondaryMuscles: ["tríceps"],
  equipmentNames: ["Barra"],
  mediaUrl: null,
  posterUrl: null,
  mediaType: "gif",
  isEquivalent: true,
  reason: "Mesmo padrão de empurrar horizontal",
  totalCount: 1,
};

test.describe("in-plan semantic swap v2.1.2", () => {
  test.skip(!configured, "Requires the generated local workout");

  test("opens per-card ranking and routes a different function to rebalance", async ({
    page,
  }) => {
    await page.route("**/api/plans/exercises/*/swap?*", async (route) => {
      const search = new URL(route.request().url()).searchParams.get("q");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            search
              ? {
                  ...candidate,
                  isEquivalent: false,
                  reason: "Função diferente no treino",
                }
              : candidate,
          ],
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 30_000 });
    await page.goto("/workouts");
    await page
      .getByRole("link", { name: /Treino GIF-first/ })
      .first()
      .click();

    await page.getByRole("button", { name: "Trocar" }).first().click();
    await expect(page.getByRole("dialog", { name: /Trocar/ })).toBeVisible();
    await expect(
      page.getByText("Mesmo padrão de empurrar horizontal"),
    ).toBeVisible();
    await expect(page.getByText("Barra", { exact: true })).toBeVisible();

    await page
      .getByLabel("Buscar exercício específico")
      .fill("Supino com barra");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Quero este exercício" }).click();
    await expect(
      page.getByText("Esse exercício tem uma função diferente no treino."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reorganizar treino" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });
});
