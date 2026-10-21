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
  await expect.poll(() => reads).toBe(1);
  await expect(page).toHaveURL(/date=2026-10-16&range=1$/);
  await expect(page.locator(".navigation-feedback")).toHaveAttribute("data-visible", "false");
  expect(reads).toBe(1);
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


test("full text reads >6000 chars to end with pending, retained retry, revision restart and cancellation", async ({ page }) => {
  const source = "文😀".repeat(4000) + "全文末尾";
  const points = Array.from(source);
  let fail = false, conflict = false, inconsistent = false, delay = 0;
  const offsets: number[] = [];
  await page.route("**/api/premium/themes/text?*", async route => {
    const url = new URL(route.request().url()); const offset = Number(url.searchParams.get("offset")); offsets.push(offset);
    await new Promise(resolve => setTimeout(resolve, delay));
    if (conflict) { await route.fulfill({ status: 409, body: "{}" }); return; }
    if (fail) { await route.fulfill({ status: 503, body: "{}" }); return; }
    const text = points.slice(offset, offset + 2000).join("");const end = offset + Array.from(text).length;
    await route.fulfill({ json: { schemaVersion: "theme-viewer-text.v1", themeId: url.searchParams.get("themeId"), recordId: url.searchParams.get("recordId"),section: url.searchParams.get("section"),field:url.searchParams.get("field"),text,offset,totalChars:points.length + (inconsistent ? 1 : 0),revision:"a".repeat(64),hasMore:end<points.length,nextOffset:end<points.length?end:null } });
  });
  await page.goto("/premium/themes/00000000-0000-4000-8000-000000000001");
  const region = page.getByRole("region", { name: "本文を全文で読む", exact: true });
  expect(offsets).toEqual([]);
  delay = 300;
  await region.getByRole("button", { name: "全文を読み始める", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("本文を取得中");
  await expect(region.getByRole("status")).toContainText("2,000 / 8,004");
  fail = true;
  await region.getByRole("button", { name: "次の2,000文字を読む", exact: true }).click();
  await expect(region.getByRole("alert")).toBeVisible();
  expect(await region.getByTestId("full-text-content").textContent()).toBe(points.slice(0, 2000).join(""));
  fail = false; delay = 0;
  await region.getByRole("button", { name: "同じ続きから再試行", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("4,000 / 8,004");
  expect(offsets.slice(-2)).toEqual([2000,2000]);
  for (let i = 0; i < 3; i++) {
    await region.getByRole("button", { name: "次の2,000文字を読む", exact: true }).click();
    await expect(region.getByRole("status")).toContainText(i === 2 ? "全文表示済み" : `${6000 + i * 2000 > 6000 ? "8,000" : "6,000"} / 8,004`);
  }
  expect(await region.getByTestId("full-text-content").textContent()).toBe(source);
  await page.getByRole("combobox", { name: "全文を読む項目" }).selectOption("1");
  await expect(region.getByRole("status")).toHaveText("未取得");
  delay = 1000;
  await region.getByRole("button", { name: "全文を読み始める", exact: true }).click();
  await region.getByRole("button", { name: "取得を中断", exact: true }).click();
  await expect(region.getByRole("alert")).toContainText("取得を中断");
  delay = 0;
  await region.getByRole("button", { name: "同じ続きから再試行", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("2,000 / 8,004");
  conflict = true;
  await region.getByRole("button", { name: "次の2,000文字を読む", exact: true }).click();
  await expect(region.getByRole("alert")).toContainText("本文が更新");
  conflict = false;
  await region.getByRole("button", { name: "最初から読み直す", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("2,000 / 8,004");
  expect(offsets.at(-1)).toBe(0);
  inconsistent = true;
  await region.getByRole("button", { name: "次の2,000文字を読む", exact: true }).click();
  await expect(region.getByRole("alert")).toContainText("本文の文字数が変わりました");
  await expect(region.getByRole("button", { name: "最初から読み直す", exact: true })).toBeVisible();
  expect(await region.getByTestId("full-text-content").textContent()).toBe(points.slice(0, 2000).join(""));
  inconsistent = false;
  await region.getByRole("button", { name: "最初から読み直す", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("2,000 / 8,004");
  expect(offsets.at(-1)).toBe(0);
});


for (const mobile of [false, true]) test(`full text readability ${mobile ? "mobile" : "desktop"}: raw, pending, failure, keyboard and end`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width:390, height:844 });
  const source = "# 調査の記録\\n\\n## 論点\\n- 根拠A\\n- 根拠B\\n\\n" + "読み進めるための段落。".repeat(220) + "\\n\\n## 結論\\n本文の末尾です。";
  const points=Array.from(source);let fail=false, delay=1000;const offsets:number[]=[];
  await page.route("**/api/premium/themes/text?*", async route => {
    const url=new URL(route.request().url());const offset=Number(url.searchParams.get("offset"));offsets.push(offset);
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(fail){await route.fulfill({status:503,body:"{}"});return;}
    const text=points.slice(offset,offset+2000).join("");const end=offset+Array.from(text).length;
    await route.fulfill({json:{schemaVersion:"theme-viewer-text.v1",themeId:url.searchParams.get("themeId"),recordId:url.searchParams.get("recordId"),section:url.searchParams.get("section"),field:url.searchParams.get("field"),text,offset,totalChars:points.length,revision:"a".repeat(64),hasMore:end<points.length,nextOffset:end<points.length?end:null}});
  });
  await page.goto("/premium/themes/00000000-0000-4000-8000-000000000001");
  const region=page.getByRole("region",{name:"本文を全文で読む",exact:true});
  const select=region.getByRole("combobox",{name:"全文を読む項目"});
  await expect(select.locator("option").first()).toContainText("2026/08/26 21:52");
  await select.press("Tab"); await expect(region.getByRole("button",{name:"整形表示",exact:true})).toBeFocused();
  await page.keyboard.press("Tab"); await expect(region.getByRole("button",{name:"原文表示",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");
  const load=region.getByRole("button",{name:"全文を読み始める",exact:true}); await expect(load).toBeFocused(); await page.keyboard.press("Enter");
  await expect(region.getByRole("status")).toContainText("本文を取得中");
  await page.screenshot({path:testInfo.outputPath("loading.png")});
  await expect(region.getByRole("status")).toContainText("2,000 /");
  await expect(region.getByRole("heading",{name:"調査の記録",exact:true})).toBeVisible();
  await expect(region.getByRole("listitem").filter({hasText:"根拠A"})).toBeVisible();
  fail=true;delay=200;
  await region.getByRole("button",{name:"次の2,000文字を読む",exact:true}).press("Enter");
  await expect(region.getByRole("alert")).toContainText("本文を取得できませんでした");
  const retry=region.getByRole("button",{name:"同じ続きから再試行",exact:true});await expect(retry).toBeFocused();
  await region.getByRole("alert").scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("failure.png")});
  fail=false;delay=0;const beforeAppend=await page.evaluate(()=>window.scrollY);await retry.press("Enter");
  await expect(region.getByRole("status")).toContainText("全文表示済み");
  await expect(region.getByText(`✓ 本文はここまでです（全${points.length.toLocaleString()}文字）`,{exact:true})).toBeVisible();
  await expect(region.getByRole("button",{name:"全文表示済み",exact:true})).toBeFocused();
  expect(Math.abs((await page.evaluate(()=>window.scrollY))-beforeAppend)).toBeLessThan(50);
  expect(offsets).toEqual([0,2000,2000]);
  await region.getByText(`✓ 本文はここまでです（全${points.length.toLocaleString()}文字）`,{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("end.png")});
  await region.getByRole("button",{name:"本文の先頭へ",exact:true}).press("Enter");
  await expect(region.getByRole("heading",{name:"本文を全文で読む",exact:true})).toBeFocused();
  await page.screenshot({path:testInfo.outputPath("formatted.png")});
  await region.getByRole("heading",{name:"調査の記録",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("formatted-body.png")});
  await region.getByRole("button",{name:"原文表示",exact:true}).press("Enter");
  expect(await region.getByTestId("full-text-content").textContent()).toBe(source);
  await page.screenshot({path:testInfo.outputPath("raw.png")});
  await region.getByRole("button",{name:"整形表示",exact:true}).press("Enter");
  expect(offsets).toEqual([0,2000,2000]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const buttonSize=await region.getByRole("button",{name:"原文表示",exact:true}).boundingBox();expect(buttonSize!.height).toBeGreaterThanOrEqual(44);
});

test("full text readability: slow and timeout retain text for retry", async ({ page }, testInfo) => {
  const source="記録。".repeat(800);const points=Array.from(source);let stalled=false;
  await page.route("**/api/premium/themes/text?*",async route=>{
    const url=new URL(route.request().url());const offset=Number(url.searchParams.get("offset"));
    if(stalled) { await new Promise(resolve=>setTimeout(resolve,15000));await route.abort().catch(()=>{});return; }
    const text=points.slice(offset,offset+2000).join("");const end=offset+Array.from(text).length;
    await route.fulfill({json:{schemaVersion:"theme-viewer-text.v1",themeId:url.searchParams.get("themeId"),recordId:url.searchParams.get("recordId"),section:url.searchParams.get("section"),field:url.searchParams.get("field"),text,offset,totalChars:points.length,revision:"a".repeat(64),hasMore:end<points.length,nextOffset:end<points.length?end:null}});
  });
  await page.goto("/premium/themes/00000000-0000-4000-8000-000000000001");
  const region=page.getByRole("region",{name:"本文を全文で読む",exact:true});
  await region.getByRole("button",{name:"全文を読み始める",exact:true}).click();await expect(region.getByRole("status")).toContainText("2,000 /");
  stalled=true;await region.getByRole("button",{name:"次の2,000文字を読む",exact:true}).click();
  await expect(region.getByRole("status")).toContainText("取得に時間がかかっています",{timeout:5000});await region.getByRole("status").scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath("slow.png")});
  await expect(region.getByRole("alert")).toContainText("取得が時間内に完了しませんでした",{timeout:11000});
  expect(await region.getByTestId("full-text-content").textContent()).toBe(points.slice(0,2000).join(""));
  stalled=false;await region.getByRole("button",{name:"同じ続きから再試行",exact:true}).click();await expect(region.getByRole("status")).toContainText("全文表示済み");
});


test("full text readability: response-body deadline reports timeout and retries", async ({ page }) => {
  await page.addInitScript(() => {
    const original=window.fetch.bind(window);let stalled=false;
    window.fetch=(input,init)=>{
      if (String(input).startsWith("/api/premium/themes/text?") && !stalled) {
        stalled=true;
        return Promise.resolve(new Response(new ReadableStream({start(controller){
          init?.signal?.addEventListener("abort",()=>controller.error(new DOMException("Aborted","AbortError")),{once:true});
        }}),{headers:{"content-type":"application/json"}}));
      }
      return original(input,init);
    };
  });
  await page.route("**/api/premium/themes/text?*",async route=>{
    const url=new URL(route.request().url());
    await route.fulfill({json:{schemaVersion:"theme-viewer-text.v1",themeId:url.searchParams.get("themeId"),recordId:url.searchParams.get("recordId"),section:url.searchParams.get("section"),field:url.searchParams.get("field"),text:"回復",offset:0,totalChars:2,revision:"a".repeat(64),hasMore:false,nextOffset:null}});
  });
  await page.goto("/premium/themes/00000000-0000-4000-8000-000000000001");
  const region=page.getByRole("region",{name:"本文を全文で読む",exact:true});
  await region.getByRole("button",{name:"全文を読み始める",exact:true}).click();
  await expect(region.getByRole("alert")).toContainText("取得が時間内に完了しませんでした",{timeout:15000});
  await region.getByRole("button",{name:"同じ続きから再試行",exact:true}).click();
  await expect(region.getByRole("status")).toContainText("全文表示済み");
});


for (const mobile of [false, true]) test(`admin market date quality ${mobile ? "mobile" : "desktop"}`, async ({ page }, testInfo) => {
  test.skip(process.env.NAVIGATION_MARKET_QUALITY_FIXTURE !== "1", "requires market quality fixture");
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "国内相場の日付品質" }).filter({visible:true});
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("国内相場：日付の整合");
  await expect(panel).toContainText("2026-10-19T15:51:19Z");
  await expect(panel.getByText("履歴内の週末：2件", {exact:true})).toHaveCount(3);
  await expect(panel).toContainText("ランキング：未確認");
  await page.screenshot({ path: testInfo.outputPath("date-quality.png") });
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  if (!mobile) {
    await expect(page.getByText("UNKNOWN", {exact:true}).filter({visible:true}).first()).toBeVisible();
    await page.getByRole("link", { name: /14-day Heatmap/ }).click();
    await expect(panel).toBeVisible();
  }
});


for (const tool of ["stock-ranking", "topix33", "nikkei-contribution"]) test(`market observation day alignment ${tool}`, async ({page}, testInfo) => {
  test.skip(process.env.NAVIGATION_MARKET_QUALITY_FIXTURE !== "1", "requires market quality fixture");
  await page.setViewportSize({width:390,height:844});
  const startedAt = Date.now();
  await page.goto(`/tools/${tool}`);
  const notice = page.getByRole("region", {name:"表示データの日付"});
  await expect(notice).toContainText("保存日：2026-10-20");
  await expect(notice).toContainText("UNKNOWN");
  if (process.env.NAVIGATION_MARKET_DATA_FILE) {
    const { readFile } = await import("node:fs/promises");
    const saved = JSON.parse(await readFile(process.env.NAVIGATION_MARKET_DATA_FILE, "utf8"));
    const family = tool === "stock-ranking" ? "ranking" : tool === "nikkei-contribution" ? "nikkei" : "topix33";
    const payload = saved[`/${family}/2026-10-20`];
    const name = tool === "topix33" ? payload.sectors[0].sector_name : payload.records[0].name;
    await expect(page.getByText(name, {exact:false}).first()).toBeVisible();
    await testInfo.attach("real-data-local-timing", {body: JSON.stringify({tool,localNavigationToContentMs:Date.now()-startedAt,marketDate:null,displayedSaveDate:payload.date}), contentType:"application/json"});
  }
  const select = page.getByRole("combobox").first();
  await expect(select.locator('option[value="2026-10-18"]')).toHaveCount(1);
  let fail = true;
  await page.route(`**/tools/${tool}/data/2026-10-18`, async route => {
    await new Promise(resolve=>setTimeout(resolve,600));
    if (fail) {await route.fulfill({status:503,json:{error:"synthetic failure"}});return;}
    const response = await route.fetch();
    await route.fulfill({response});
  });
  await select.focus();
  await select.selectOption("2026-10-18");
  await expect(notice).toContainText("保存日：2026-10-20");
  await expect(page.getByRole("button",{name:"同じ日で再試行"})).toBeVisible();
  fail=false;
  await page.getByRole("button",{name:"同じ日で再試行"}).focus();
  await page.keyboard.press("Enter");
  await expect(notice).toContainText("保存日：2026-10-18");
  expect(await notice.evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
});
