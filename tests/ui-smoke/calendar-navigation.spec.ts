import { expect, test } from "@playwright/test";

function week(date: string) {
  return { as_of_date: date, source: "fixture", week_start: date, week_end: date,
    calendar: [{date, weekday_jp: "月", events: [{time: "09:00", country_tag: "JP", indicator: "Calendar retry fixture", impact: 3}]}] };
}

test("initial month loading is not an empty result and successful rows replace it", async ({ page }) => {
  await page.route("**/api/econ-calendar/2026-*", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({json: week(new URL(route.request().url()).pathname.split("/").at(-1)!)});
  });
  await page.goto("/tools/econ-calendar");
  await page.getByRole("button", {name: "月表示", exact: true}).click();
  await expect(page.getByText("月のデータを取得中…", {exact: true})).toBeVisible();
  await expect(page.getByText("この月のデータはまだ発行されていません")).toHaveCount(0);
  await expect(page.getByText("Calendar retry fixture").first()).toBeVisible();
  await expect(page.getByText("月のデータを取得中…", {exact: true})).toHaveCount(0);
});

test("failed month retries its own weeks and switching to week clears its error", async ({ page }) => {
  let failing = true;
  let requests = 0;
  await page.route("**/api/econ-calendar/2026-*", async route => {
    requests++;
    await route.fulfill(failing ? {status: 503, body: "unavailable"} : {json: week(new URL(route.request().url()).pathname.split("/").at(-1)!)});
  });
  await page.goto("/tools/econ-calendar");
  await page.getByRole("button", {name: "月表示", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("選択月の取得に失敗");
  await expect(page.getByText("この月のデータはまだ発行されていません")).toHaveCount(0);
  const failedRequests = requests;
  failing = false;
  await page.getByRole("button", {name: "同じ条件で再試行", exact: true}).click();
  await expect(page.getByText("Calendar retry fixture").first()).toBeVisible();
  expect(requests).toBeGreaterThan(failedRequests);
  await page.reload();
  failing = true;
  await page.getByRole("button", {name: "月表示", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("選択月の取得に失敗");
  const beforeSwitch = requests;
  await page.getByRole("button", {name: "週表示", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", {name: "同じ条件で再試行", exact: true})).toHaveCount(0);
  expect(requests).toBe(beforeSwitch);
});

test("switching to month also clears the failed week operation", async ({ page }) => {
  let failing = true;
  await page.route("**/api/econ-calendar/2026-*", async route => {
    await route.fulfill(failing ? {status: 503, body: "unavailable"} : {json: week(new URL(route.request().url()).pathname.split("/").at(-1)!)});
  });
  await page.goto("/tools/econ-calendar");
  await page.getByRole("button", {name: "‹ 前の週", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("選択週の取得に失敗");
  failing = false;
  await page.getByRole("button", {name: "月表示", exact: true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Calendar retry fixture").first()).toBeVisible();
});
