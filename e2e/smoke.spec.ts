import { test, expect } from "@playwright/test";

test("loads the app and checks login page", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("NORDIKA").first()).toBeVisible({
    timeout: 10000,
  });
});
