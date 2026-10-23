import { expect, test } from "@playwright/test";

for (const tool of ["stock-ranking", "topix33", "nikkei-contribution"]) {
  test(`${tool}: same-day update, failed refresh and recovery without reload`, async ({ page, request }) => {
    await page.clock.install();
    await page.goto(`/tools/${tool}`);
    const notice = page.getByRole("region", { name: "表示データの日付" });
    await expect(notice).toContainText("2026-10-20T00:50:00Z");
    const response = await request.get(`/tools/${tool}/data/2026-10-20`);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const current = await response.json();
    let fail = true;
    let requests = 0;
    await page.route(`**/tools/${tool}/data/2026-10-20`, async route => {
      requests++;
      if (fail) return route.fulfill({ status: 503, body: "offline" });
      return route.fulfill({ json: { ...current, observation: { ...current.observation, snapshot_id: "c".repeat(32), collected_at: "2026-10-20T01:50:00Z" } } });
    });
    await page.clock.fastForward(60_000);
    await expect(page.getByText("最新データの確認に失敗しました。", { exact: false })).toBeVisible();
    await expect(notice).toContainText("2026-10-20T00:50:00Z");
    fail = false;
    await page.clock.fastForward(60_000);
    await expect(notice).toContainText("2026-10-20T01:50:00Z");
    await expect(page.getByText("最新データの確認に失敗しました。", { exact: false })).toHaveCount(0);
    expect(requests).toBe(2);
    await page.setViewportSize({ width: 390, height: 844 });
    const dateSelect = page.locator("select").first();
    await dateSelect.focus();
    await expect(dateSelect).toBeFocused();
    await page.clock.fastForward(60_000);
    await expect.poll(() => requests).toBe(3);
    await expect(dateSelect).toBeFocused();
  });
}

test("ranking: cancelled refresh cannot overwrite a newly selected day", async ({ page, request }) => {
  await page.clock.install();
  await page.goto("/tools/stock-ranking");
  const current = await (await request.get("/tools/stock-ranking/data/2026-10-20")).json();
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  let started = false;
  await page.route("**/tools/stock-ranking/data/2026-10-20", async route => {
    started = true; await gate;
    await route.fulfill({ json: { ...current, observation: { ...current.observation, collected_at: "2026-10-20T09:00:00Z" } } }).catch(() => {});
  });
  await page.clock.fastForward(60_000);
  await expect.poll(() => started).toBe(true);
  await page.locator("select").first().selectOption("2026-09-24");
  release();
  await expect(page.getByRole("region", { name: "表示データの日付" })).toContainText("保存日：2026-09-24");
  await expect(page.getByRole("region", { name: "表示データの日付" })).not.toContainText("09:00:00");
});

test("ranking: hidden tabs pause polling; foreground and retry deduplicate requests", async ({ page, request }) => {
  await page.clock.install();
  await page.goto("/tools/stock-ranking");
  const current = await (await request.get("/tools/stock-ranking/data/2026-10-20")).json();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route("**/tools/stock-ranking/data/2026-10-20", async route => {
    calls++; await gate; await route.fulfill({ json: current });
  });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.fastForward(120_000);
  expect(calls).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(60_000);
  expect(calls).toBe(1);
  release();
});
