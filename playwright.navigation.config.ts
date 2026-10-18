import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const output = process.env.NAVIGATION_TEST_OUTPUT_DIR ?? path.join(os.tmpdir(), "mini-tools-navigation-uat");
export default defineConfig({
  testDir: "./tests/ui-smoke", testMatch: "navigation.spec.ts",
  timeout: 30000, workers: 1, retries: 0,
  reporter: [["list"]], outputDir: path.join(output, "artifacts"),
  use: { channel: process.env.NAVIGATION_BROWSER_CHANNEL ?? "msedge", baseURL: "http://127.0.0.1:18842", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "node tests/ui-smoke/navigation-fixture.mjs", url: "http://127.0.0.1:18841/health", reuseExistingServer: false },
    { command: "node tests/ui-smoke/start-navigation-app.mjs", url: "http://127.0.0.1:18842", reuseExistingServer: false, timeout: 180000,
      env: { ...process.env, PREMIUM_ACCESS_PASSWORD: "fixture-password", PREMIUM_ACCESS_SECRET: "fixture-premium-secret",
        STOCK_NOTES_API_BASE_URL: "http://127.0.0.1:18841", STOCK_NOTES_API_TOKEN: "fixture-token",
        MARKET_INFO_API_BASE_URL: "", MINI_TOOLS_ENABLE_LOCAL_DATA_FALLBACK: "1", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NEXT_PUBLIC_GA_ID: "" } },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
