import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.UI_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const basePort = new URL(baseURL).port || "80";

export default defineConfig({
  testDir: "./tests/ui-smoke",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".tmp/ui-smoke-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: ".tmp/ui-smoke-artifacts/test-results",
  webServer: {
    command: `npx next dev --webpack --port ${basePort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_GA_ID: "",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
