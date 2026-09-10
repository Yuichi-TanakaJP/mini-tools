import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";

for (const disrupted of [false, true]) test(`dashboard DB saves and preserves legacy data (disrupted: ${disrupted})`, async ({ page, context }) => {
  const date = "2026-09-09T00:00:00Z", owner = "00000000-0000-4000-8000-000000000001";
  const profile = { id: "p", stock_code: "1234", display_name: "接続テスト銘柄", portfolio_instrument_id: null,
    cross_strategy: "未設定", priority: 2, memo: "DBメモ", active: true, one_share_started_on: "2024-03-01", one_share_started_legacy_text: null,
    entry_timing: null, default_preparation_months_before: null, tenure_rule: null, related_url: null, official_benefit_url: null,
    revision: 1, created_at: date, updated_at: date };
  const months = [8, 9].map(month => ({ id: `m${month}`, profile_id: "p", entitlement_month: month, preparation_months_before: month === 9 ? 0 : null,
    required_shares: month === 9 ? 200 : 100, benefit_value_yen: 5000, long_term_required: false, long_term_benefit: true, month_memo: "keep", revision: 1, created_at: date, updated_at: date }));
  const selections = [{ id: "global", stock_code: "1234", entitlement_month: null as number | null, selection_status: "picked", revision: 1, created_at: date, updated_at: date }];
  const cycles = [{ id: "old", profile_id: "p", entitlement_year: 2025, entitlement_month: 9, status: "received", planned_at: null,
    prepared_at: "2025-08-01T00:00:00Z", rights_secured_at: null, settled_at: null, received_at: null, skipped_at: null,
    quantity: 100, account_label: null, note: "前年履歴", revision: 1, created_at: date, updated_at: date }];
  const writes: { request_id: string; command_type: string; expected_revision: number; target: { id?: string; entitlement_month?: number }; payload: Record<string, unknown> }[] = [];
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let legacyWrites = 0;
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  const payload = `${Date.now()}.synthetic`;
  await context.addCookies([
    { name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" },
    { name: "mini_tools_premium", value: `${payload}.${createHmac("sha256", "synthetic-test-secret").update(payload).digest("hex")}`, url: "http://127.0.0.1:3146" },
  ]);
  await page.addInitScript(() => { for (const key of ["monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1", "yutai_memo_items_v1", "yutai_memo_archives_v1"]) localStorage.setItem(key, "legacy-sentinel"); });
  await page.route("**/api/sync**", route => { if (route.request().method() !== "GET") legacyWrites++; return route.fulfill({ json: { items: [] } }); });
  await page.route("**/api/yutai/stock-prices**", route => route.fulfill({ status: 503, json: {} }));
  await page.route("**/api/yutai/launch-display**", route => route.fulfill({ status: 503, json: {} }));
  await page.route("https://yutai-test.supabase.co/**", async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    const args = route.request().postDataJSON();
    if (url.endsWith("stock_notes_record_yutai_command")) {
      const c = args.p_input, replayed = writes.some(w => w.request_id === c.request_id); writes.push(c);
      const target = c.command_type === "update_profile" ? profile : months.find(m => m.id === c.target.id);
      if (target && c.expected_revision !== target.revision) { await route.fulfill({ status: 409, json: { code: "40001", message: "REVISION_CONFLICT" } }); return; }
      if (!replayed) {
        if (c.command_type === "set_selection") selections.push({ ...selections[0], id: "monthly", entitlement_month: c.target.entitlement_month, selection_status: c.payload.selection_status });
        else if (target) { Object.assign(target, c.payload); target.revision++; }
        else throw new Error(`Unexpected command ${c.command_type}`);
      }
      if (disrupted && writes.length === 1) { await route.abort("failed"); return; }
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
  await page.getByRole("row").filter({ hasText: "接続テスト銘柄" }).first().click();
  await expect(page.getByLabel("優待の必要株数")).toHaveValue("200");
  await page.getByLabel("優待価値（円）", { exact: true }).fill("6000.5");
  await page.getByLabel("優待価値（円）", { exact: true }).press("Tab");
  await expect.poll(() => months[1].benefit_value_yen).toBe(6000.5);
  expect(months[0].benefit_value_yen).toBe(5000);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  // Labels in the legacy detailed editor are text headings; scope to its textarea.
  await expect(page.locator("textarea")).toHaveValue("DBメモ");
  await page.locator("textarea").fill("ダッシュボードで編集");
  if (disrupted) { profile.memo = "別端末の更新"; profile.revision++; }
  await page.getByRole("button", { name: "保存", exact: true }).click();
  if (disrupted) {
    await expect(page.getByRole("button", { name: "最新データを確認して編集をやり直す" })).toBeVisible();
    expect(profile.memo).toBe("別端末の更新");
    await page.getByRole("button", { name: "最新データを確認して編集をやり直す" }).click();
    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page.locator("textarea")).toHaveValue("別端末の更新");
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
  await page.screenshot({ path: `.tmp/yutai-dashboard-${disrupted}.png`, fullPage: true });
});

test("dashboard retains premium login protection", async ({ page }) => {
  await page.goto("/tools/yutai-dashboard?month=2026-09");
  await expect(page).toHaveURL(/\/premium\/login/);
});
