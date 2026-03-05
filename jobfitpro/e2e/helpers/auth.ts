import { type Page } from "@playwright/test";

/**
 * Navigate to a protected URL.
 * If storageState cookies are rejected (redirect to /login), performs a full
 * login and navigates back. This makes tests resilient to auth session
 * invalidation between runs without adding a full login to every test when
 * the session is still valid.
 */
export async function gotoProtected(page: Page, url: string) {
  await page.goto(url);

  // If the app redirected us to login (storageState cookie rejected),
  // perform a real login and navigate back to the intended URL.
  if (page.url().includes("/login")) {
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/dashboard|resume/, { timeout: 30_000 });

    // If the intended URL wasn't the post-login landing page, navigate there now
    if (new URL(page.url()).pathname !== url) {
      await page.goto(url);
    }
  }
}
