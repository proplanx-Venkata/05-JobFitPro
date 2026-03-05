import { test, expect } from "@playwright/test";

// Auth tests run without shared storageState — each test controls its own login flow.

test.describe("Auth flows", () => {
  test("unauthenticated visit to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("login with valid credentials lands on dashboard or resume page", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|resume/, { timeout: 15_000 });
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill("wrongpassword_xyz");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Error toast or inline error message should appear
    await expect(
      page.getByText(/invalid|incorrect|failed|error/i)
    ).toBeVisible({ timeout: 10_000 });
    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("logout redirects away from protected area", async ({ page }) => {
    // Log in first
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|resume/, { timeout: 15_000 });

    // Click the avatar button (rounded-full trigger in the header)
    await page.locator("button[class*='rounded-full']").click();

    // Click "Sign out" in the dropdown
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should be redirected to login
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});
