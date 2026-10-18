import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";

async function mode(request: import("@playwright/test").APIRequestContext, delay = 0, status = 200) {
  await request.get(`http://127.0.0.1:18841/control?delay=${delay}&status=${status}`);
}
test.beforeEach(async ({ context, request }) => {
  await mode(request);
  const payload = `${Date.now()}.fixture`;
  await context.addCookies([{ name: "mini_tools_premium", value: `${payload}.${createHmac("sha256", "fixture-premium-secret").update(payload).digest("hex")}`, url: "http://127.0.0.1:18842" }]);
});

test("Viewer accepts 5.5s cold latency and shows immediate receipt, delayed feedback and completion", async ({ page, request }, testInfo) => {
  await page.goto("/premium/themes");
  await expect(page.getByRole("heading", { name: "Fixture Theme 1" })).toBeVisible();
  await page.evaluate(() => {
    let clicked = 0;
    document.addEventListener("click", () => { clicked = performance.now(); }, { capture: true, once: true });
    new MutationObserver(records => {
      if (records.some(r => r.attributeName === "data-navigation-pending" && (r.target as HTMLElement).dataset.navigationPending === "true")) {
        (window as unknown as { receipt: number }).receipt = performance.now() - clicked;
      }
    }).observe(document.body, { attributes: true, subtree: true });
  });
  await mode(request, 5500);
  await page.getByRole("link", { name: "続きを見る →" }).click();
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "true");
  await expect(page.locator(".navigation-feedback")).toContainText("取得に時間がかかっています", { timeout: 4500 });
  await page.screenshot({ path: testInfo.outputPath("viewer-delayed.png") });
  await expect(page.getByRole("heading", { name: "Fixture Theme 2" })).toBeVisible({ timeout: 7000 });
  expect(await page.evaluate(() => (window as unknown as { receipt: number }).receipt)).toBeLessThanOrEqual(100);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("failed continuation keeps the last good list and retries the same cursor", async ({ page, request }) => {
  await page.goto("/premium/themes");
  await mode(request, 0, 503);
  await page.getByRole("link", { name: "続きを見る →" }).click();
  await expect(page.getByText("HTTP 503", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "前回取得できた一覧" })).toContainText("Fixture Theme 1");
  await page.getByRole("button", { name: "同じ条件で再試行", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fixture Theme 2" })).toBeVisible();
  await expect(page).toHaveURL(/cursor=page2/);
  expect(await page.content()).not.toContain("fixture-private-upstream-body");
  expect(await page.content()).not.toContain("fixture-token");
});

test("Viewer timeout is classified and recovery retains the current condition", async ({ page, request }) => {
  await page.goto("/premium/themes");
  await mode(request, 9000);
  await page.getByRole("link", { name: "続きを見る →" }).click();
  await expect(page.getByText("取得が時間内に完了しませんでした。同じ条件で再試行できます。")).toBeVisible({ timeout: 12000 });
  await page.getByRole("button", { name: "同じ条件で再試行", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fixture Theme 2" })).toBeVisible();
});

test("detail returns to the originating cursor, including history navigation", async ({ page }) => {
  await page.goto("/premium/themes?cursor=page2");
  await page.getByRole("link", { name: /Fixture Theme 2/ }).click();
  await expect(page.getByRole("heading", { name: "Fixture Theme 2", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "← テーマ一覧" })).toHaveAttribute("href", "/premium/themes?cursor=page2");
  await page.getByRole("link", { name: "← テーマ一覧" }).click();
  await expect(page).toHaveURL(/themes\?cursor=page2$/);
  await page.goBack(); await expect(page).toHaveURL(/theme-2\?cursor=page2$/);
  await page.goForward(); await expect(page).toHaveURL(/themes\?cursor=page2$/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("a newer navigation wins and leaves no stale pending state", async ({ page, request }) => {
  await page.goto("/premium/themes");
  await mode(request, 2000);
  await page.getByRole("link", { name: /Fixture Theme 1/ }).click();
  await page.getByRole("link", { name: "Premium へ移動", exact: true }).click();
  await expect(page).toHaveURL(/\/premium$/);
  await expect(page.getByRole("heading", { name: "分析と管理を、ひとつに。" }).first()).toBeVisible();
  await page.waitForTimeout(2300);
  await expect(page).toHaveURL(/\/premium$/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("mobile bottom navigation, drawer and local interactions keep working", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/total");
  await page.getByRole("button", { name: "メニューを開く" }).click();
  const drawer = page.getByRole("dialog", { name: "ツールメニュー" });
  await drawer.getByRole("link", { name: /文字数カウント/ }).click();
  await expect(page).toHaveURL(/charcount$/);
  await expect(drawer).toHaveAttribute("inert", /.*/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
  await page.getByRole("navigation").last().getByRole("link", { name: "ホーム", exact: true }).click();
  await expect(page).toHaveURL("/");
});

function pageRoutes(directory = "app"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? pageRoutes(file) : entry.name === "page.tsx" ? ["/" + path.dirname(file).replaceAll("\\", "/").replace(/^app\/?/, "").replace("[themeId]", "theme-1")] : [];
  });
}
for (const route of pageRoutes()) {
  test(`route entry and fallback: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("画面を表示できませんでした");
    await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false", { timeout: 15000 });
    expect(errors).toEqual([]);
  });
}

test("date switching cancels stale work, retains the labeled good day, and retries", async ({ page }) => {
  await page.goto("/tools/stock-ranking");
  const select = page.getByRole("combobox").first();
  const dates = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  expect(dates.length).toBeGreaterThan(1);
  let fail = true;
  await page.route("**/tools/stock-ranking/data/*", async route => {
    const date = new URL(route.request().url()).pathname.split("/").at(-1);
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: fail ? 503 : 200, contentType: "application/json", body: JSON.stringify({ date, records: [] }) });
  });
  await select.selectOption(dates[1]);
  await expect(page.getByText(`表示中: ${dates[0]}`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "同じ日で再試行" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "同じ日で再試行" }).click();
  await expect(page.getByText("要求中の選択日とは異なります。", { exact: false })).toHaveCount(0);
  await select.selectOption(dates[0]);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("native GET condition submission reports pending and preserves its URL", async ({ page }) => {
  await page.goto("/premium/tdnet-router");
  const form = page.locator('form[method="get"]');
  await expect(form).toBeVisible();
  await page.route("**/premium/tdnet-router?*", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  let sawPending = false;
  await page.exposeFunction("recordNativePending", () => { sawPending = true; });
  await page.evaluate(() => {
    const feedback = document.querySelector(".navigation-feedback")!;
    new MutationObserver(() => {
      if (feedback.getAttribute("data-visible") === "true") void (window as unknown as { recordNativePending: () => Promise<void> }).recordNativePending();
    }).observe(feedback, { attributes: true });
  });
  await form.evaluate(form => (form as HTMLFormElement).requestSubmit());
  await expect.poll(() => sawPending).toBe(true);
  await expect(page).toHaveURL(/tdnet-router\?/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("anonymous protection and login full navigation retain the requested cursor", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/premium/themes?cursor=page2");
  await expect(page).toHaveURL(/premium\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/premium/themes?cursor=page2");
  await page.getByLabel("パスワード", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Premium に入る", exact: true }).click();
  await expect(page).toHaveURL(/themes\?cursor=page2$/);
  await expect(page.getByRole("heading", { name: "Fixture Theme 2" })).toBeVisible();
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("a stalled page move offers recovery at twelve seconds and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/premium?*", async route => {
    if (route.request().headers()["next-router-prefetch"]) { await route.abort(); return; }
    await new Promise(resolve => setTimeout(resolve, 14000));
    await route.continue();
  });
  await page.goto("/premium/themes");
  await page.getByRole("link", { name: "Premium へ移動", exact: true }).click();
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "true");
  await expect(page.locator(".navigation-progress")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".navigation-recovery").getByRole("button", { name: "再読み込み", exact: true })).toBeVisible({ timeout: 13500 });
  await expect(page).toHaveURL(/\/premium$/, { timeout: 5000 });
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("same-URL display is a real retry with pending feedback", async ({ page }) => {
  await page.goto("/tools/tdnet-disclosures?date=2026-10-16&range=1");
  let reads = 0;
  await page.route("**/tools/tdnet-disclosures?*", async route => {
    if (route.request().headers().rsc === "1") { reads++; await new Promise(resolve => setTimeout(resolve, 600)); }
    await route.continue();
  });
  await page.getByRole("button", { name: "表示", exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(page).toHaveURL(/date=2026-10-16&range=1$/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
});

test("failed date can be reselected after a cached date without stale errors", async ({ page }) => {
  await page.goto("/tools/stock-ranking");
  const select = page.getByRole("combobox").first();
  const dates = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  let fail = true;
  await page.route("**/tools/stock-ranking/data/*", async route => {
    const date = new URL(route.request().url()).pathname.split("/").at(-1);
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({ status: fail ? 503 : 200, contentType: "application/json", body: JSON.stringify({ date, records: [] }) });
  });
  await select.selectOption(dates[1]);
  await expect(page.getByRole("button", { name: "同じ日で再試行" })).toBeVisible();
  await select.selectOption(dates[0]);
  fail = false;
  await select.selectOption(dates[1]);
  await expect(page.locator(".data-pending")).toBeVisible();
  await expect(page.getByRole("button", { name: "同じ日で再試行" })).toHaveCount(0);
  await expect(page.locator(".data-pending")).toHaveCount(0);
  await expect(page.getByText("要求中の選択日とは異なります。", { exact: false })).toHaveCount(0);
});

test("disclosure retry preserves the failed range, topic and search", async ({ page }) => {
  const latest = "2026-10-18"; const older = "2026-10-01";
  const dates = [older, latest];
  let fail = true; let olderReads = 0;
  await page.route("**/api/disclosure-events/manifest", route => route.fulfill({ json: { schema_version: "disclosure-events-manifest-v1", generated_at: "2026-10-18", latest, dates } }));
  await page.route(/\/api\/disclosure-events\/\d{4}-\d{2}-\d{2}$/, async route => {
    const date = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (date === older) olderReads++;
    await route.fulfill({ status: date === older && fail ? 503 : 200, json: { schema_version: "disclosure-events-v1", target_date: date, generated_at: "2026-10-18", total_count: 0, items: [] } });
  });
  await page.goto("/tools/disclosure-radar");
  await expect(page.locator(".data-pending")).toHaveCount(0);
  await page.getByRole("tab", { name: /保有・ウォッチ/ }).click();
  await page.getByRole("button", { name: "重要", exact: true }).click();
  await page.getByRole("textbox", { name: "イベント検索" }).fill("fixture filter");
  await page.getByRole("button", { name: "30日", exact: true }).click();
  await expect(page.getByRole("button", { name: "同じ条件で再試行" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "同じ条件で再試行" }).click();
  await expect.poll(() => olderReads).toBe(2);
  await expect(page.getByRole("textbox", { name: "イベント検索" })).toHaveValue("fixture filter");
  await expect(page.getByRole("button", { name: "30日", exact: true })).toHaveClass(/chipActive/);
  await expect(page.getByRole("button", { name: "重要", exact: true })).toHaveClass(/chipActive/);
  await expect(page.getByRole("tab", { name: /保有・ウォッチ/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "同じ条件で再試行" })).toHaveCount(0);
  await expect(page.locator(".data-pending")).toHaveCount(0);
});
