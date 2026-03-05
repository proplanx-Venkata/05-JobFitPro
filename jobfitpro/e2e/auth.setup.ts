import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard|resume/, { timeout: 15_000 });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
