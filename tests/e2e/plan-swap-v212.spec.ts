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

  test("persistent exclusion succeeds and offers non-blocking remaining-day reorganization", async ({
    page,
  }) => {
    await page.route("**/api/plans/exercises/*/swap*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            eventId: "e2130000-0000-4000-8000-000000000001",
            planId: "e2130000-0000-4000-8000-000000000002",
            dayId: "e2130000-0000-4000-8000-000000000003",
            sourceExerciseName: "Supino no chão com halteres",
            persistentExclusion: true,
            remainingOccurrenceCount: 1,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ candidates: [candidate] }),
      });
    });
    await page.route(
      "**/api/plans/exercise-changes/*/remaining",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            planId: "e2130000-0000-4000-8000-000000000004",
            dayId: "e2130000-0000-4000-8000-000000000005",
            changes: [
              {
                kind: "replacement",
                day: "Treino C",
                before: "Supino no chão com halteres",
                after: "Flexão de braços",
              },
            ],
          }),
        });
      },
    );

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
    await page
      .getByRole("button", { name: "Trocar", exact: true })
      .last()
      .click();
    await page
      .getByLabel("Não quero este exercício nos meus treinos futuros")
      .check();
    await page.getByRole("button", { name: "Confirmar troca" }).click();

    await expect(
      page.getByText(
        "Esse exercício ainda aparece em outros dias do seu plano atual.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reorganizar outros dias" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reorganizar outros dias" }).click();
    await expect(page.getByText("Revise a reorganização")).toBeVisible();
    await expect(page.getByText(/Treino C/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      page.getByText(
        "Esse exercício ainda aparece em outros dias do seu plano atual.",
      ),
    ).toBeVisible();
  });
});
