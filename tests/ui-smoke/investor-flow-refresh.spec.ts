import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("weekly update changes the body without reload; failure retains data and retry recovers", async ({ page, request }) => {
  await page.clock.install();
  let documents = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) documents++; });
  await page.goto("/tools/investor-flow");
  await page.clock.runFor(100);
  const original = await request.get("/tools/investor-flow/data");
  expect(original.status()).toBe(200);
  expect(original.headers()["cache-control"]).toBe("no-store");
  const initial = await original.json();
  const initialDocuments = documents;
  const week = { start_date: "2026-10-19", end_date: "2026-10-23", path: "new.json" };
  const updated = { ...initial, selectedWeek: week,
    manifest: { ...initial.manifest, latest: week, weeks: [week, ...initial.manifest.weeks] },
    analysisManifest: { ...initial.analysisManifest, latest: week },
    payload: { ...initial.payload, ...week, generated_at_jst: "2026-10-29T08:00:00Z", records: initial.payload.records.map((row: Record<string, unknown>) => ({ ...row, diff_yen: 123400000000 })) },
    analysis: { ...initial.analysis, ...week, generated_at_jst: "2026-10-29T08:00:00Z" },
  };
  let fail = true; let calls = 0;
  await page.route("**/tools/investor-flow/data", async route => {
    calls++;
    await route.fulfill(fail ? { status: 503, json: { error: "offline" } } : { json: updated });
  });
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("status").filter({ hasText: "最新データの確認に失敗" })).toContainText("表示中の週と金額を保持");
  await expect(page.getByText("2026/10/13 - 2026/10/16", { exact: true }).first()).toBeVisible();
  fail = false;
  const button = page.getByRole("button", { name: "更新を再試行" });
  await button.focus();
  await expect(button).toBeFocused();
  await button.press("Enter");
  await expect(page.getByText("2026/10/19 - 2026/10/23", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1,234億円", { exact: false }).first()).toBeVisible();
  expect(documents).toBe(initialDocuments);
  expect(calls).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "投資主体別売買動向" })).toBeVisible();
});

test("history stays pinned and hidden tabs do not poll", async ({ page, request }) => {
  await page.clock.install();
  await page.goto("/tools/investor-flow?start=2026-10-05&end=2026-10-09");
  const current = await (await request.get("/tools/investor-flow/data?start=2026-10-05&end=2026-10-09")).json();
  let calls = 0;
  await page.route("**/tools/investor-flow/data?*", async route => {
    calls++;
    expect(new URL(route.request().url()).searchParams.get("start")).toBe("2026-10-05");
    await route.fulfill({ json: current });
  });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.fastForward(120_000);
  expect(calls).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByText("2026/10/05 - 2026/10/09", { exact: true }).first()).toBeVisible();
});


test("a delayed latest refresh cannot overwrite a newly selected history week", async ({ page }) => {
  await page.clock.install();
  await page.goto("/tools/investor-flow");
  await page.clock.runFor(100);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/tools/investor-flow/data", async route => {
    calls++; await gate;
    await route.fulfill({ status: 503, json: { error: "old request" } }).catch(() => {});
  });
  await page.clock.fastForward(60_000);
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(60_000);
  // The bounded request has timed out by now; switching history must clear its failure.
  await page.getByRole("link", { name: "2026/10/05 - 2026/10/09", exact: true }).click();
  await expect(page).toHaveURL(/start=2026-10-05/);
  release();
  await expect(page.getByText("2026/10/05 - 2026/10/09", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "更新を再試行" })).toHaveCount(0);
});


test.describe("production service worker", () => {
  test.use({ serviceWorkers: "allow" });
  test("live reads are not served from CacheStorage when offline", async ({ page, context }) => {
    await page.goto("/tools/investor-flow");
    // Register the generated production worker explicitly; next-pwa auto
    // registration differs between router/runtime versions.
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    expect(await page.evaluate(async () => (await fetch("/tools/investor-flow/data")).status)).toBe(200);
    const cachedLive = await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const name of keys) for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname === "/tools/investor-flow/data") return true;
      }
      return false;
    });
    expect(cachedLive).toBe(false);
    await context.setOffline(true);
    const offline = await page.evaluate(async () => {
      try { await fetch("/tools/investor-flow/data"); return false; } catch { return true; }
    });
    expect(offline).toBe(true);
    await context.setOffline(false);
  });
});


test("fresh server props update a retained client without waiting for a poll", async ({ page, request }) => {
  await request.get("http://127.0.0.1:19441/investor-flow-fixture-control?version=0");
  await page.clock.install();
  await page.goto("/tools/investor-flow?marker=server-props");
  await page.clock.runFor(100);
  await request.get("http://127.0.0.1:19441/investor-flow-fixture-control?version=1");
  await page.getByRole("link", { name: "2026/10/13 - 2026/10/16", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:19443/tools/investor-flow");
  await expect(page.getByText("9億円", { exact: false }).first()).toBeVisible();
  await request.get("http://127.0.0.1:19441/investor-flow-fixture-control?version=0");
});


test("week switching retains the details view and expanded groups", async ({ page }) => {
  await page.goto("/tools/investor-flow");
  await page.getByRole("button", { name: /^詳細/ }).click();
  const details = page.locator("details").first();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await page.getByRole("link", { name: "2026/10/05 - 2026/10/09", exact: true }).click();
  await expect(page).toHaveURL(/start=2026-10-05/);
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
});
