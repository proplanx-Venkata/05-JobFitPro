import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.test.local") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // share one dev server — run serially
  workers: 1, // force strictly sequential — prevents concurrent Supabase logins
  retries: 1,
  timeout: 60_000, // extended: fallback login + page load can take 20-30s on local Supabase
  expect: { timeout: 10_000 },
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /auth\.spec\.ts/, // auth tests run in auth-tests project (no storageState)
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "auth-tests",
      testMatch: /auth\.spec\.ts/,
      use: devices["Desktop Chrome"], // no storageState — tests own login flow
    },
  ],
});
