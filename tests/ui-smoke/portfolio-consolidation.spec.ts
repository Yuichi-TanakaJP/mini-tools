import { expect, test } from "@playwright/test";

test("removed my-stocks returns 404 without touching legacy storage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("my_stocks_items_v1", JSON.stringify([{ code: "7203", memo: "local-only" }])));
  const response = await page.goto("/tools/my-stocks");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /マイ銘柄/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("my_stocks_items_v1")!)[0].memo)).toBe("local-only");
  await expect(page.getByRole("button", { name: "追加", exact: true })).toHaveCount(0);
});

test("audience unavailable is visible instead of silently claiming no holdings", async ({ page }) => {
  await page.route("**/api/stock-notes/audience", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }));
  await page.goto("/tools/disclosure-radar");
  await expect(page.getByText("保有・ウォッチを取得できませんでした。対象0件とは判定していません。")).toBeVisible();
  await expect(page.getByRole("tab", { name: /保有・ウォッチ/ })).toBeVisible();
});
