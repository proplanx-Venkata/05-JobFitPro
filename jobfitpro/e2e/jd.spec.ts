import { test, expect } from "@playwright/test";
import jdFixture from "./fixtures/jd.json";
import { gotoProtected } from "./helpers/auth";

// These tests run with the shared authenticated session.
// POST /api/jds is intercepted. The initial page render is server-side (real
// Supabase data), so mock GETs don't affect the initial load. Tests focus on
// client-side behaviour (form submit, redirects, tracker).

test.describe("JD management", () => {
  test("JD list page loads without error", async ({ page }) => {
    await gotoProtected(page, "/jds");
    await expect(page).toHaveURL(/jds/);
    await expect(
      page.getByRole("heading", { name: /job listings/i })
    ).toBeVisible();
  });

  test("submit JD via URL → mock POST → redirected to JD detail page", async ({
    page,
  }) => {
    // JdForm does router.push('/jds/${data.data.id}') on success — not a list refresh
    await page.route("**/api/jds", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(jdFixture),
        });
      } else {
        await route.continue();
      }
    });

    await gotoProtected(page, "/jds");

    // URL tab is default — fill the input
    const urlInput = page.locator('input[name="url"]');
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://example.com/jobs/senior-engineer");

    // Submit
    await page.getByRole("button", { name: /^add$/i }).click();

    // JdForm redirects to /jds/[id] on success
    await expect(page).toHaveURL(
      new RegExp(`jds/${jdFixture.data.id}`),
      { timeout: 10_000 }
    );
  });

  test("JD form shows error toast on failed POST", async ({ page }) => {
    await page.route("**/api/jds", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid URL" }),
        });
      } else {
        await route.continue();
      }
    });

    await gotoProtected(page, "/jds");

    const urlInput = page.locator('input[name="url"]');
    await urlInput.fill("https://example.com/bad-url");
    await page.getByRole("button", { name: /^add$/i }).click();

    // Error toast should appear
    await expect(page.getByText(/invalid url|failed/i)).toBeVisible({
      timeout: 5_000,
    });
    // Should stay on /jds
    await expect(page).toHaveURL(/\/jds$/);
  });

  test("application status tracker visible on JD detail page (real data)", async ({
    page,
  }) => {
    // Navigate to /jds and click the first available JD if one exists
    await gotoProtected(page, "/jds");

    const viewBtn = page
      .getByRole("button", { name: /view.*analyze|analyze/i })
      .first();
    const hasJd = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasJd) {
      // No JDs for this test user — skip
      test.skip();
      return;
    }

    await viewBtn.click();
    await expect(page).toHaveURL(/jds\//, { timeout: 5_000 });

    // JdTracker renders a native <select> with APPLICATION STATUS label
    await expect(page.locator("select").first()).toBeVisible({ timeout: 5_000 });
  });
});
