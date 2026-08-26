import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

test.describe("reconciled application access", () => {
  test.skip(!configured, "Requires the generated local E2E account");

  async function signIn(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/today|onboarding/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
  }

  test("opens member and admin read flows without an ACL regression", async ({
    page,
  }) => {
    await signIn(page);

    const routes = [
      ["/workouts", /Plano E2E GIF-first|Treinos/],
      ["/progress", /Seu progresso/],
      ["/admin/media-review", /Biblioteca de exercícios/],
      ["/admin/release-readiness", /Release Readiness/],
    ] as const;

    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}$`),
      );
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
    }
  });

  test("filters the v2.1 exercise library and opens a media-ready detail", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/exercises");
    await expect(
      page.getByRole("heading", { name: "Exercícios", exact: true }),
    ).toBeVisible();

    await page.getByPlaceholder("Buscar exercício ou músculo").fill("Leg press");
    const exercise = page.getByRole("button", { name: "Ver Leg press" });
    await expect(exercise).toBeVisible();
    await expect(exercise.getByText("Demonstração")).toBeVisible();
    await exercise.click();
    await expect(page.getByText("Apoie toda a coluna")).toBeVisible();
  });
});
