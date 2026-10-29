import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";

test.use({ hasTouch: true });

for (const [disrupted, mobile, keyboard] of [[false, false, false], [true, false, false], [true, true, false], [true, true, true]]) test(`dashboard DB saves and preserves legacy data (disrupted: ${disrupted}, mobile: ${mobile}, keyboard: ${keyboard})`, async ({ page, context }) => {
  const date = "2026-09-09T00:00:00Z", owner = "00000000-0000-4000-8000-000000000001";
  const profile = { id: "p", stock_code: "1234", display_name: "接続テスト銘柄", portfolio_instrument_id: null,
    cross_strategy: "未設定", priority: 2, memo: "DBメモ", active: true, one_share_started_on: "2024-03-01", one_share_started_legacy_text: null,
    entry_timing: null, default_preparation_months_before: null, tenure_rule: null, related_url: null, official_benefit_url: null,
    revision: 1, created_at: date, updated_at: date };
  const months = [8, 9].map(month => ({ id: `m${month}`, profile_id: "p", entitlement_month: month, preparation_months_before: month === 9 ? 0 : null,
    required_shares: month === 9 ? 200 : 100, benefit_value_yen: month === 9 ? null : 5000, long_term_required: false, long_term_benefit: true, month_memo: "keep", revision: 1, created_at: date, updated_at: date }));
  const selections = [{ id: "global", stock_code: "1234", entitlement_month: null as number | null, selection_status: "picked", revision: 1, created_at: date, updated_at: date }];
  const cycles = [{ id: "old", profile_id: "p", entitlement_year: 2025, entitlement_month: 9, status: "received", planned_at: null,
    prepared_at: "2025-08-01T00:00:00Z", rights_secured_at: null, settled_at: null, received_at: null, skipped_at: null,
    quantity: 100, account_label: null, note: "前年履歴", revision: 1, created_at: date, updated_at: date }];
  const writes: { request_id: string; command_type: string; expected_revision: number; target: { id?: string; entitlement_month?: number }; payload: Record<string, unknown> }[] = [];
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let legacyWrites = 0;
  let profileResponsePending = false;
  let releaseProfileResponse: (() => void) | undefined;
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  const payload = `${Date.now()}.synthetic`;
  await context.addCookies([
    { name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" },
    { name: "mini_tools_premium", value: `${payload}.${createHmac("sha256", "synthetic-test-secret").update(payload).digest("hex")}`, url: "http://127.0.0.1:3146" },
  ]);
  await page.addInitScript(() => { for (const key of ["monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1", "yutai_memo_items_v1", "yutai_memo_archives_v1"]) localStorage.setItem(key, "legacy-sentinel"); });
  await page.route("**/api/sync**", route => { if (route.request().method() !== "GET") legacyWrites++; return route.fulfill({ json: { items: [] } }); });
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/yutai/stock-prices**", route => {
    const now = new Date();
    const scope = new URL(route.request().url()).searchParams.get("month");
    return route.fulfill({ json: { schema_version: 1, generated_at: now.toISOString(), scope_month: scope,
      provider: "synthetic", record_count: 1, success_count: 1,
      records: [{code: "1234", price: 2139, price_date: now.toISOString().slice(0, 10), fetched_at: now.toISOString(), status: "ok"}] } });
  });
  await page.route("**/api/yutai/launch-display**", route => route.fulfill({ json: {
    schema_version: 1, generated_at: date, month: "2026-09", record_count: 1,
    counts: {conditions_available: 1, auto_calculable: 0, requires_user_valuation: 1},
    records: [{month: "2026-09", code: "1234", company_name: "接続テスト銘柄",
      display_status: "conditions_available", calculation_status: "user_input_required", requires_user_valuation: true,
      programs: [{program_id: "synthetic", label: "合成条件", rights_months: [9],
        tiers: [100, 300, 500, 1000].map(shares => ({minimum_shares: shares, required_holding_months: 0,
          groups: [{mode: "all", allow_repeated_choices: false,
            items: [{label: "評価未入力の品物", kind: "goods", valuation_policy: "user_estimate_required"}]}]}))}]}]
  } }));
  await page.route("https://yutai-test.supabase.co/**", async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    const args = route.request().postDataJSON();
    if (url.endsWith("stock_notes_record_yutai_command")) {
      const c = args.p_input, replayed = writes.some(w => w.request_id === c.request_id); writes.push(c);
      const target = c.command_type === "update_profile" ? profile : months.find(m => m.id === c.target.id);
      if (!replayed && target && c.expected_revision !== target.revision) { await route.fulfill({ status: 409, json: { code: "40001", message: "REVISION_CONFLICT" } }); return; }
      if (!replayed) {
        if (c.command_type === "set_selection") selections.push({ ...selections[0], id: "monthly", entitlement_month: c.target.entitlement_month, selection_status: c.payload.selection_status });
        else if (target) { Object.assign(target, c.payload); target.revision++; }
        else throw new Error(`Unexpected command ${c.command_type}`);
      }
      if (disrupted && writes.length === 1) { await route.abort("failed"); return; }
      if (disrupted && c.command_type === "update_profile" && !replayed && !profileResponsePending) {
        profileResponsePending = true;
        await new Promise<void>(resolve => { releaseProfileResponse = resolve; });
        await route.abort("failed"); return;
      }
      await route.fulfill({ json: { schema_version: 1, command_type: c.command_type, request_id: c.request_id, target_id: c.target.id ?? "monthly", revision: target?.revision ?? 1, event_id: "audit", replayed, before: null, after: {} } }); return;
    }
    if (!url.endsWith("stock_notes_get_yutai_workspace")) { legacyWrites++; await route.fulfill({ json: [] }); return; }
    await route.fulfill({ json: { schema_version: 1, selected_month: args.p_month, as_of: date,
      counts: { profiles: 1, month_states: 2, cycles: 1, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0, selections: selections.length, effective_selections: 0 },
      profiles: [profile], month_states: months, cycles, tags: [], profile_tags: [], rewards: [], reward_events: [], selections, effective_selections: [] } });
  });
  await page.goto("/tools/yutai-dashboard?month=2026-09");
  await expect(page.getByRole("complementary", { name: "保存状態" })).toBeVisible();
  await page.getByRole("button", { name: "パスする", exact: true }).click();
  if (disrupted) {
    await expect(page.getByText(/今回の保存結果は不明/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^パス/ })).toBeDisabled();
    await page.getByRole("button", { name: "同じ要求を再確認・続行" }).click();
  }
  await expect(page.getByText("保存しました", { exact: true })).toBeVisible();
  expect(writes[0]).toMatchObject({ command_type: "set_selection", target: { entitlement_month: 9 }, expected_revision: 0 });
  if (disrupted) expect(writes[0]).toEqual(writes[1]);
  expect(selections[0].selection_status).toBe("picked");
  await page.getByRole("cell", { name: "接続テスト銘柄", exact: true }).first().click();
  await expect(page.getByLabel("優待の必要株数")).toHaveValue("200");
  await expect(page.getByText("必要購入金額 ¥427,800", { exact: true })).toBeVisible();
  for (const shares of [100, 300, 500]) {
    await page.getByLabel("優待の必要株数").fill(String(shares));
    await page.getByLabel("優待の必要株数").press("Tab");
    await expect(page.getByText(`必要購入金額 ¥${(2139 * shares).toLocaleString("ja-JP")}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("優待価値（円）", { exact: true })).toHaveValue("");
  await page.getByLabel("優待の必要株数").fill("");
  await page.getByLabel("優待の必要株数").press("Tab");
  await expect(page.getByText("必要購入金額 ¥1,069,500", { exact: true })).toHaveCount(0);
  for (const shares of [100, 300, 500, 1000]) {
    await expect(page.getByText(new RegExp(`${shares.toLocaleString("ja-JP")}株:.*必要購入金額 ¥${(2139 * shares).toLocaleString("ja-JP")}`))).toBeVisible();
  }
  await expect(page.getByText(/株価基準日.*synthetic/)).toBeVisible();
  await page.getByLabel("優待価値（円）", { exact: true }).fill("6000.5");
  await page.getByLabel("優待価値（円）", { exact: true }).press("Tab");
  await expect.poll(() => months[1].benefit_value_yen).toBe(6000.5);
  expect(months[0].benefit_value_yen).toBe(5000);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  // Labels in the legacy detailed editor are text headings; scope to its textarea.
  await expect(page.locator("textarea")).toHaveValue("DBメモ");
  await page.locator("textarea").fill("ダッシュボードで編集");
  if (disrupted) {
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect.poll(() => !!releaseProfileResponse).toBe(true);
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("textarea")).toBeDisabled();
    await expect(page.locator("textarea")).toHaveValue("ダッシュボードで編集");
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
    releaseProfileResponse!();
    await expect(page.getByText(/今回の保存結果は不明/)).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("textarea")).toBeDisabled();
    await expect(page.locator("textarea")).toHaveValue("ダッシュボードで編集");
    const mutationsBeforeRetry = writes.length;
    const retry = page.getByRole("button", { name: "同じ要求を再確認・続行" });
    if (mobile) await retry.tap(); else await retry.click();
    await expect(page.getByText("保存しました", { exact: true })).toBeVisible();
    expect(writes[mutationsBeforeRetry].request_id).toBe(writes[mutationsBeforeRetry - 1].request_id);
    expect(profile.memo).toBe("ダッシュボードで編集");
    await page.getByRole("button", { name: "編集", exact: true }).click();
    await page.locator("textarea").fill("競合する編集内容");
    profile.memo = "別端末の更新"; profile.revision++;
  }
  await page.getByRole("button", { name: "保存", exact: true }).click();
  if (disrupted) {
    await expect(page.getByRole("button", { name: "最新データを確認して編集をやり直す" })).toBeVisible();
    expect(profile.memo).toBe("別端末の更新");
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("textarea")).toBeDisabled();
    await expect(page.locator("textarea")).toHaveValue("競合する編集内容");
    const mutationsBeforeReview = writes.length;
    const recover = page.getByRole("button", { name: "最新データを確認して編集をやり直す" });
    if (keyboard) {
      for (let i = 0; i < 24; i++) {
        if (await recover.evaluate(element => element === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(recover).toBeFocused();
      await page.keyboard.press("Enter");
    } else if (mobile) await recover.tap({ timeout: 5_000 });
    else await recover.click({ timeout: 5_000 });
    expect(writes).toHaveLength(mutationsBeforeReview);
    expect(profile.memo).toBe("別端末の更新");
    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page.locator("textarea")).toHaveValue("別端末の更新");
    expect(writes).toHaveLength(mutationsBeforeReview);
  } else { await expect.poll(() => profile.memo).toBe("ダッシュボードで編集"); }
  expect(cycles[0]).toMatchObject({ entitlement_year: 2025, note: "前年履歴" });
  expect(legacyWrites).toBe(0);
  expect(await page.evaluate(() => ["monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1", "yutai_memo_items_v1", "yutai_memo_archives_v1"].map(k => localStorage.getItem(k)))).toEqual(Array(5).fill("legacy-sentinel"));
  expect(errors).toEqual([]);
  if (disrupted) await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.goto("/tools/yutai-dashboard?month=all");
  await expect(page.getByRole("complementary", { name: "保存状態" })).toBeVisible();
  const rows = page.getByRole("row").filter({ hasText: "接続テスト銘柄" });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole("button", { name: "★", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rows.nth(1).getByRole("button", { name: "パスを解除", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "12ヶ月ビュー", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "接続テスト銘柄" })).toHaveCount(1);
  await page.goto("/tools/yutai-dashboard?month=2026-09");
  await page.getByLabel("表示軸").selectOption("preparation");
  await page.getByRole("cell", { name: "接続テスト銘柄", exact: true }).first().click();
  await expect(page.getByText(/1,000株:.*必要購入金額 ¥2,139,000/)).toBeVisible();
  await expect(page.getByText(/株価基準日.*synthetic/)).toBeVisible();
  await page.screenshot({ path: `.tmp/yutai-dashboard-${disrupted}-${mobile}-${keyboard}.png`, fullPage: true });
  if (mobile) {
    await page.mouse.click(8, 200);
    await expect(page.locator("aside").filter({ hasText: "接続テスト銘柄" })).toHaveCount(0);
    await page.getByRole("cell", { name: "接続テスト銘柄", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "接続テスト銘柄", exact: true })).toBeVisible();
  }
});

test("dashboard retains premium login protection", async ({ page }) => {
  await page.goto("/tools/yutai-dashboard?month=2026-09");
  await expect(page).toHaveURL(/\/premium\/login/);
});
