import { expect, test } from "@playwright/test";
test("landing and login are usable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
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
  for (const [width, height] of [
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});
