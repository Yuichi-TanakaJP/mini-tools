import navigation from "./playwright.navigation.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...navigation,
  testMatch: "calendar-navigation.spec.ts",
  webServer: (Array.isArray(navigation.webServer) ? navigation.webServer : []).map(server => ({
    ...server,
    env: { ...server.env, MARKET_INFO_API_BASE_URL: "http://127.0.0.1:18841/calendar-fixture", NAVIGATION_CALENDAR_FIXTURE: "1" },
  })),
});
