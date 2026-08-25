import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.E2E_TEST_EMAIL &&
  process.env.E2E_TEST_PASSWORD &&
  process.env.E2E_SESSION_ID,
);

test.describe("workout experience v1.8", () => {
  test.skip(!configured, "Requires the generated local v1.8 workout");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 15_000 });
  });

  test("resumes, explains exercises and blocks empty completion", async ({
    page,
  }) => {
    await page.goto("/today");
    await expect(page.getByText("Treino em andamento")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retomar treino" }),
    ).toBeVisible();

    await page.goto(`/workout-session/${process.env.E2E_SESSION_ID}`);
    await expect(page.getByRole("button", { name: "Finalizar" })).toBeVisible();
    await expect(
      page
        .locator(
          '[data-testid="exercise-preview-gif"], [data-testid="exercise-preview-video"]',
        )
        .or(page.getByText("Vídeo ainda não disponível"))
        .first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Ver detalhes de/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "Como fazer" }),
    ).toBeVisible();
    await expect(page.getByText("Séries", { exact: true })).toBeVisible();
    await expect(page.getByText("Descanso", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    await page.getByRole("button", { name: "Finalizar" }).click();
    await expect(
      page.getByText("Conclua pelo menos uma série ou atividade"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Concluir mesmo assim" }),
    ).toBeDisabled();
    await expect(page.getByText("Cancelar não é concluir")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });

  test("shows plan/history navigation and age-safe body intelligence", async ({
    page,
  }) => {
    await page.goto("/workouts");
    await expect(
      page.getByRole("navigation", { name: "Visualização dos treinos" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Treino GIF-first/ }).first().click();
    await expect(
      page.getByRole("button", { name: /Ver detalhes de/ }).first(),
    ).toBeVisible();
    await page.goto("/workouts");
    await page.getByRole("link", { name: /Histórico/ }).click();
    await expect(
      page.getByRole("heading", { name: "Histórico" }),
    ).toBeVisible();

    await page.goto("/progress");
    await expect(
      page.getByText("O IMC é um indicador de triagem"),
    ).toBeVisible();
    await expect(page.getByText("Faixa saudável")).toBeVisible();
  });
});
