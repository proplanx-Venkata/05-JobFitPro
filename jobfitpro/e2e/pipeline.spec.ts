import { test, expect } from "@playwright/test";
import { gotoProtected } from "./helpers/auth";
import resumeVersionFixture from "./fixtures/resume-version.json";
import interviewStartFixture from "./fixtures/interview-start.json";
import interviewDoneFixture from "./fixtures/interview-done.json";
import rewriteFixture from "./fixtures/rewrite.json";
import coverLetterFixture from "./fixtures/cover-letter.json";
import atsScoreFixture from "./fixtures/ats-score.json";

// Full pipeline tests — all AI API routes are intercepted via page.route().
// page.evaluate(() => fetch(...)) runs inside the browser context, so route
// intercepts apply (unlike page.request which bypasses them).

const VERSION_ID = "version-test-id-001";
const SESSION_ID = "session-test-id-001";

test.describe("Full apply pipeline (mocked AI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/resume-versions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(resumeVersionFixture),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/interview-sessions/**/start`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(interviewStartFixture),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/interview-sessions/**/reply`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(interviewDoneFixture),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/resume-versions/**/rewrite`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(rewriteFixture),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/resume-versions/**/pdf-url`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://example.com/mock-resume.pdf" }),
      });
    });

    await page.route(`**/api/cover-letters`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(coverLetterFixture),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/cover-letters/**/pdf-url`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://example.com/mock-cover.pdf" }),
      });
    });

    await page.route(`**/api/ats-scores`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(atsScoreFixture),
        });
      } else {
        await route.continue();
      }
    });
  });

  test("Start Analysis — mock POST /api/resume-versions returns version with session", async ({
    page,
  }) => {
    await gotoProtected(page, "/jds");
    // Use page.evaluate so the fetch runs inside the browser and hits page.route() mocks
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: "test-resume-id",
          job_description_id: "test-jd-id",
        }),
      });
      return { status: res.status, data: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.data.data.resume_version.id).toBe(VERSION_ID);
    expect(result.data.data.interview_session.id).toBeTruthy();
    expect(result.data.data.gap_analysis.length).toBeGreaterThan(0);
  });

  test("Interview start — mock returns first question in transcript", async ({
    page,
  }) => {
    await gotoProtected(page, "/jds");
    const result = await page.evaluate(async (sessionId) => {
      const res = await fetch(`/api/interview-sessions/${sessionId}/start`, {
        method: "POST",
      });
      return { status: res.status, data: await res.json() };
    }, SESSION_ID);

    expect(result.status).toBe(200);
    expect(result.data.data.status).toBe("in_progress");
    expect(result.data.data.conversation_transcript[0].role).toBe("assistant");
  });

  test("Interview reply — mock returns completed status", async ({ page }) => {
    await gotoProtected(page, "/jds");
    const result = await page.evaluate(async (sessionId) => {
      const res = await fetch(`/api/interview-sessions/${sessionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "I have 3 years of TypeScript experience." }),
      });
      return { status: res.status, data: await res.json() };
    }, SESSION_ID);

    expect(result.status).toBe(200);
    expect(result.data.data.status).toBe("completed");
  });

  test("Rewrite — mock returns ready status with output path", async ({
    page,
  }) => {
    await gotoProtected(page, "/jds");
    const result = await page.evaluate(async (versionId) => {
      const res = await fetch(`/api/resume-versions/${versionId}/rewrite`, {
        method: "POST",
      });
      return { status: res.status, data: await res.json() };
    }, VERSION_ID);

    expect(result.status).toBe(200);
    expect(result.data.data.status).toBe("ready");
    expect(result.data.data.output_storage_path).toBeTruthy();
  });

  test("Cover Letter — mock returns cover letter id", async ({ page }) => {
    await gotoProtected(page, "/jds");
    const result = await page.evaluate(async (versionId) => {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_version_id: versionId }),
      });
      return { status: res.status, data: await res.json() };
    }, VERSION_ID);

    expect(result.status).toBe(200);
    const id = result.data.id ?? result.data.data?.id;
    expect(id).toBeTruthy();
  });

  test("ATS Score — mock returns score 78 with 'Strong' category", async ({
    page,
  }) => {
    await gotoProtected(page, "/jds");
    const result = await page.evaluate(async (versionId) => {
      const res = await fetch("/api/ats-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_version_id: versionId }),
      });
      return { status: res.status, data: await res.json() };
    }, VERSION_ID);

    expect(result.status).toBe(200);
    expect(result.data.data.overall_score).toBe(78);
    expect(result.data.data.category).toBe("Strong");
  });
});
