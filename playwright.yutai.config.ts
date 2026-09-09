import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui-smoke", testMatch: ["yutai-connection.spec.ts", "yutai-rewards.spec.ts", "yutai-dashboard.spec.ts"], timeout: 60_000,
  workers: 1, retries: 0, outputDir: ".tmp/yutai-browser-results",
  use: { baseURL: "http://127.0.0.1:3146", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "node tests/ui-smoke/yutai-fixture-server.mjs", url: "http://127.0.0.1:3147", reuseExistingServer: false },
    { command: "npx next dev --webpack --port 3146", url: "http://127.0.0.1:3146", reuseExistingServer: false, timeout: 120_000,
      env: { ...process.env, NEXT_PUBLIC_GA_ID: "", NEXT_PUBLIC_YUTAI_CANDIDATES_DB_PREVIEW: "true", NEXT_PUBLIC_YUTAI_MEMO_DB_PREVIEW: "true",
        NEXT_PUBLIC_YUTAI_EXPIRY_DB_PREVIEW: "true",
        NEXT_PUBLIC_YUTAI_DASHBOARD_DB_PREVIEW: "true", PREMIUM_ACCESS_PASSWORD: "synthetic-test-password", PREMIUM_ACCESS_SECRET: "synthetic-test-secret",
        NEXT_PUBLIC_SUPABASE_URL: "https://yutai-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key",
        MARKET_INFO_API_BASE_URL: "http://127.0.0.1:3147" } },
  ],
});
