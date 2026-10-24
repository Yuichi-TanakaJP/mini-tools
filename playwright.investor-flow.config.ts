import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui-smoke",
  testMatch: "investor-flow-refresh.spec.ts",
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  outputDir: ".tmp/investor-flow-artifacts",
  use: { baseURL: "http://127.0.0.1:19443", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "node tests/ui-smoke/navigation-fixture.mjs", url: "http://127.0.0.1:19441/health", reuseExistingServer: !process.env.CI, env: { NAVIGATION_FIXTURE_PORT: "19441" } },
    { command: "node tests/ui-smoke/start-investor-flow-app.mjs", url: "http://127.0.0.1:19443/tools/investor-flow", timeout: 180_000, reuseExistingServer: !process.env.CI },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.UI_SMOKE_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.UI_SMOKE_EXECUTABLE_PATH } } : {}) } }],
});
