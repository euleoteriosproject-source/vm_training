import { expect, test } from "@playwright/test";
test("landing and login are usable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Treine com intenção/ }),
  ).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/login$/),
    page.getByRole("link", { name: "Entrar" }).first().click(),
  ]);
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
});
test("has no horizontal overflow at required breakpoints", async ({ page }) => {
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});
