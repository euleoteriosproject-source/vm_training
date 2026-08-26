import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

test.describe("training preferences v2.1.1", () => {
  test.skip(!configured, "Requires the generated local E2E account");

  test("simplifies gym setup and previews a goal-driven plan without silent activation", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/today|onboarding/, { timeout: 30_000 });

    await page.goto("/settings/preferences");
    await expect(
      page.getByRole("heading", { name: "Preferências de treino" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Objetivo" })).toBeVisible();
    await expect(page.getByText("Academia comercial padrão")).toBeVisible();
    await expect(page.getByText("Equipamentos disponíveis")).toHaveCount(0);

    const strength = page.getByRole("button", { name: /^Força\./ });
    const health = page.getByRole("button", {
      name: /^Saúde e condicionamento\./,
    });
    if ((await strength.getAttribute("aria-pressed")) === "true")
      await health.click();
    else await strength.click();

    await page.getByRole("button", { name: "Salvar preferências" }).click();
    const main = page.getByRole("main");
    await expect(
      main.getByText("Suas preferências foram atualizadas."),
    ).toBeVisible();
    await expect(main.getByText("Seu treino atual continua ativo.")).toBeVisible();

    const previewResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/plans/generate",
    );
    await page.getByRole("button", { name: "Atualizar meu treino" }).click();
    const previewResponse = await previewResponsePromise;
    const previewBody = await previewResponse.text();
    expect(previewResponse.status(), previewBody).toBe(201);
    await expect(page.getByText("Prévia do novo plano")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: "Confirmar e ativar" }),
    ).toBeVisible();
    await expect(
      main.getByText(
        "Seu plano atual só será arquivado depois da sua confirmação.",
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });
});
