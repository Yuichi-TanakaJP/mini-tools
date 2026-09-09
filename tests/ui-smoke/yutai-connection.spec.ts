import { expect, test } from "@playwright/test";
import type { Cycle } from "../../lib/yutai/contracts";

const date = "2026-09-09T00:00:00Z";
const owner = "00000000-0000-4000-8000-000000000001";
const row = { id: "profile", stock_code: "1234", display_name: "接続テスト銘柄", portfolio_instrument_id: null,
  cross_strategy: "未設定", priority: 2, memo: "DBメモ", active: true, one_share_started_on: null, one_share_started_legacy_text: null,
  entry_timing: null, default_preparation_months_before: null, tenure_rule: null, related_url: null, official_benefit_url: null,
  revision: 1, created_at: date, updated_at: date };
for (const loseFirstResponse of [false, true]) {
test(`calendar reads/saves without legacy writes (lost response: ${loseFirstResponse})`, async ({ page, context }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const profile = { ...row };
  const monthState = { id: "month", profile_id: "profile", entitlement_month: 9, preparation_months_before: 0,
    required_shares: 100, benefit_value_yen: 5000, long_term_required: false, long_term_benefit: true, month_memo: "", revision: 1, created_at: date, updated_at: date };
  const selections = [{ id: "global", stock_code: "1234", entitlement_month: null as number | null, selection_status: "picked", revision: 1, created_at: date, updated_at: date }];
  const writes: Record<string, unknown>[] = [];
  const tags: { id: string; name: string; revision: number; created_at: string; updated_at: string }[] = [];
  let profileTags: { profile_id: string; tag_id: string; created_at: string }[] = [];
  const oldCycle: Cycle = { id: "old-cycle", profile_id: "profile", entitlement_year: 2025, entitlement_month: 9,
    status: "received", planned_at: null, prepared_at: "2025-08-01T00:00:00.123456Z", rights_secured_at: null,
    settled_at: null, received_at: null, skipped_at: null, quantity: 100, account_label: null, note: "前年記録を保持",
    revision: 4, created_at: date, updated_at: date };
  const cycles: Cycle[] = [{ ...oldCycle }];
  let lostCycleResponse = false;
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer",
    user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.addInitScript(() => {
    for (const key of ["monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1", "yutai_memo_items_v1", "yutai_memo_tags_v1", "yutai_memo_archives_v1", "yutai_memo_migrated_tags_v1"]) localStorage.setItem(key, "legacy-sentinel");
  });
  await page.route("**/api/sync**", route => route.fulfill({ json: { items: [] } }));
  await page.route("https://yutai-test.supabase.co/**", async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    const args = route.request().postDataJSON();
    if (url.endsWith("stock_notes_record_yutai_command")) {
      const command = args.p_input;
      const replayed = writes.some(previous => previous.request_id === command.request_id);
      writes.push(command);
      if (!replayed && command.command_type === "set_selection") {
        selections.push({ ...selections[0], id: "monthly", entitlement_month: command.target.entitlement_month, selection_status: command.payload.selection_status });
      } else if (!replayed && command.command_type === "update_profile") { Object.assign(profile, command.payload); profile.revision++; }
      else if (!replayed && command.command_type === "update_month_state") { Object.assign(monthState, command.payload); monthState.revision++; }
      else if (!replayed && command.command_type === "create_tag") { tags.push({ id: "new-tag", name: command.payload.name, revision: 1, created_at: date, updated_at: date }); }
      else if (!replayed && command.command_type === "update_tag") { tags[0].name = command.payload.name; tags[0].revision++; }
      else if (!replayed && command.command_type === "set_profile_tags") {
        profileTags = command.payload.tag_ids.map((id: string) => ({ profile_id: profile.id, tag_id: id, created_at: date })); profile.revision++; tags[0].revision++;
      } else if (!replayed && command.command_type === "delete_tag") { tags.splice(0); profileTags = []; }
      else if (!replayed && command.command_type === "create_cycle") { cycles.push({ ...command.payload, id: "new-cycle", revision: 1, created_at: date, updated_at: date }); }
      else if (!replayed && command.command_type === "update_cycle") { const cycle = cycles.find(c => c.id === command.target.id)!; Object.assign(cycle, command.payload); cycle.revision++; }
      else if (!replayed && command.command_type === "delete_cycle") { cycles.splice(cycles.findIndex(c => c.id === command.target.id), 1); }
      if (loseFirstResponse && writes.length === 1) { await route.abort("failed"); return; }
      if (loseFirstResponse && command.command_type === "create_cycle" && !lostCycleResponse) { lostCycleResponse = true; await route.abort("failed"); return; }
      const deleted = command.command_type.startsWith("delete_");
      await route.fulfill({ json: { schema_version: 1, command_type: command.command_type, request_id: command.request_id, target_id: "target", revision: deleted ? null : 1, event_id: "audit", replayed, before: null, after: deleted ? null : {} } }); return;
    }
    const month = args.p_month;
    const monthly = selections.filter(s => s.entitlement_month === month).at(-1);
    await route.fulfill({ json: { schema_version: 1, selected_month: month, as_of: date,
      counts: { profiles: 1, month_states: 1, cycles: cycles.length, tags: tags.length, profile_tags: profileTags.length, rewards: 0, reward_events: 0, selections: selections.length, effective_selections: 1 },
      profiles: [profile], month_states: [monthState],
      cycles, tags, profile_tags: profileTags, rewards: [], reward_events: [], selections,
      effective_selections: [{ stock_code: "1234", selection_status: monthly?.selection_status ?? "picked", selection_scope: monthly ? "monthly" : "global" }],
    } });
  });
  await page.goto("/tools/yutai-candidates?month=2026-09");
  await expect(page.getByText("Supabase接続の検証モード（カレンダーのみ）")).toBeVisible();
  await expect(page.getByRole("button", { name: "★ ピック" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "パスする", exact: true }).click();
  if (loseFirstResponse) {
    await expect(page.getByText(/今回の保存結果は不明/)).toBeVisible();
    await expect(page.getByRole("button", { name: "メモ編集", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "同じ要求を再確認・続行" }).click();
  }
  await expect(page.getByText("Supabaseへ保存し、表示を更新しました。")).toBeVisible();
  expect(writes[0]).toMatchObject({ command_type: "set_selection", target: { stock_code: "1234", entitlement_month: 9 }, expected_revision: 0 });
  await page.getByRole("button", { name: "メモ編集", exact: true }).click();
  await expect(page.getByLabel("戦略タイプ")).toHaveValue("未設定");
  await page.getByRole("textbox", { name: "メモ", exact: true }).fill("変更したDBメモ");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ", exact: true })).toHaveCount(0);
  expect(writes.find(command => command.command_type === "update_profile")).toMatchObject({ payload: { memo: "変更したDBメモ" }, expected_revision: 1 });
  if (loseFirstResponse) expect(writes[0]).toEqual(writes[1]);
  const oldValues = await page.evaluate(() => ["monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1", "yutai_memo_items_v1"].map(key => localStorage.getItem(key)));
  expect(oldValues).toEqual(Array(4).fill("legacy-sentinel"));
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".tmp/yutai-calendar-connected.png", fullPage: true });
  await page.goto("/tools/yutai-memo");
  await expect(page.getByText("Supabase接続の検証モード（メモ帳の基本編集）")).toBeVisible();
  await page.getByRole("button", { name: "メモ編集", exact: true }).click();
  await page.getByRole("textbox", { name: "メモ", exact: true }).fill("メモ帳から更新");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "銘柄メモ編集" })).toHaveCount(0);
  await expect(page.getByText("メモ帳から更新", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "9月：100株 / 5000円", exact: true }).click();
  await page.getByLabel("株数", { exact: true }).fill("200");
  await page.getByLabel("優待価値（円）", { exact: true }).fill("6000.5");
  await page.getByRole("button", { name: "月別設定を保存" }).click();
  await expect(page.getByRole("dialog", { name: "月別設定編集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "9月：200株 / 6000.5円", exact: true })).toBeVisible();
  expect(writes.at(-1)).toMatchObject({ command_type: "update_month_state", target: { id: "month" }, expected_revision: 1,
    payload: { required_shares: 200, benefit_value_yen: 6000.5 } });
  await page.getByRole("button", { name: "タグ管理", exact: true }).click();
  await page.getByLabel("タグ名", { exact: true }).fill("検証タグ");
  await page.getByRole("button", { name: "タグを保存", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "タグ管理", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "タグを編集", exact: true }).click();
  await page.getByRole("checkbox", { name: "検証タグ", exact: true }).check();
  await page.getByRole("button", { name: "タグ付与を保存", exact: true }).click();
  await expect(page.getByText("タグ: 検証タグ", { exact: true })).toBeVisible();
  expect(writes.at(-1)).toMatchObject({ command_type: "set_profile_tags", target: { id: "profile" }, payload: { tag_ids: ["new-tag"] } });
  await page.getByRole("button", { name: "タグ管理", exact: true }).click();
  await page.getByLabel("編集するタグ").selectOption("new-tag");
  await page.getByLabel("タグ名", { exact: true }).fill("名称変更");
  await page.getByRole("button", { name: "タグを保存", exact: true }).click();
  await expect(page.getByText("タグ: 名称変更", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "タグ管理", exact: true }).click();
  await page.getByLabel("編集するタグ").selectOption("new-tag");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "タグを削除", exact: true }).click();
  await expect(page.getByText("タグ: なし", { exact: true })).toBeVisible();
  await page.getByText("全年度の仕込み履歴（1件）", { exact: true }).click();
  await page.getByRole("button", { name: "履歴を追加", exact: true }).click();
  await expect(page.getByLabel("権利年", { exact: true })).toBeEmpty();
  await page.getByLabel("権利年", { exact: true }).fill("2026");
  await page.getByLabel("権利月", { exact: true }).selectOption("9");
  await page.getByLabel("履歴の状態").selectOption("prepared");
  await page.getByRole("button", { name: "履歴を保存", exact: true }).click();
  await expect(page.getByText("仕込み済みには仕込み日時が必要です。", { exact: true })).toBeVisible();
  expect(writes.filter(c => c.command_type === "create_cycle")).toHaveLength(0);
  await page.getByLabel("仕込み日時", { exact: true }).fill("2026-08-15T12:30");
  await page.getByLabel("仕込み株数", { exact: true }).fill("200");
  await page.getByLabel("履歴メモ", { exact: true }).fill("検証履歴");
  await page.getByRole("dialog", { name: "仕込み履歴編集" }).screenshot({ path: ".tmp/yutai-cycle-editor.png" });
  await page.getByRole("button", { name: "履歴を保存", exact: true }).click();
  if (loseFirstResponse) {
    await expect(page.getByText(/今回の保存結果は不明/)).toBeVisible();
    await expect(page.getByRole("button", { name: "履歴を保存", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "同じ要求を再確認・続行" }).click();
  }
  await expect(page.getByRole("dialog", { name: "仕込み履歴編集" })).toHaveCount(0);
  expect(cycles).toHaveLength(2);
  const createRequests = writes.filter(c => c.command_type === "create_cycle");
  if (loseFirstResponse) expect(createRequests[0]).toEqual(createRequests[1]);
  const savedTimestamp = cycles[1].prepared_at;
  await page.getByRole("button", { name: "2026年9月の履歴を編集", exact: true }).click();
  await page.getByLabel("履歴の状態").selectOption("settled");
  await page.getByRole("button", { name: "履歴を保存", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "仕込み履歴編集" })).toHaveCount(0);
  expect(writes.at(-1)).toMatchObject({ command_type: "update_cycle", target: { id: "new-cycle" }, expected_revision: 1, payload: { status: "settled" } });
  expect(writes.at(-1)?.payload).toEqual({ status: "settled" });
  expect(cycles[1].prepared_at).toBe(savedTimestamp);
  await page.getByRole("button", { name: "2026年9月の履歴を編集", exact: true }).click();
  await page.getByText("この履歴を削除", { exact: true }).click();
  await page.getByLabel("削除理由", { exact: true }).fill("合成テスト記録の削除");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "履歴を削除", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "仕込み履歴編集" })).toHaveCount(0);
  expect(cycles).toEqual([oldCycle]);
  await expect(page.getByRole("button", { name: "9月：200株 / 6000.5円", exact: true })).toBeVisible();
  const memoKeys = await page.evaluate(() => ["yutai_memo_items_v1", "yutai_memo_tags_v1", "yutai_memo_archives_v1", "yutai_memo_migrated_tags_v1"].map(key => localStorage.getItem(key)));
  expect(memoKeys).toEqual(Array(4).fill("legacy-sentinel"));
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".tmp/yutai-memo-connected.png", fullPage: true });
});
}

test("signed out does not show cached or local private data", async ({ page }) => {
  await page.goto("/tools/yutai-candidates?month=2026-09");
  await expect(page.getByText("Supabaseへのログインが必要です。")).toBeVisible();
  await expect(page.getByRole("button", { name: "メモ編集", exact: true })).toHaveCount(0);
  await page.goto("/tools/yutai-memo");
  await expect(page.getByText("Supabaseへのログインが必要です。")).toBeVisible();
  await expect(page.getByRole("button", { name: "銘柄を追加", exact: true })).toHaveCount(0);
});
