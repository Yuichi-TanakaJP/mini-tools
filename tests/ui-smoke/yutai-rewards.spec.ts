import { expect, test } from "@playwright/test";
import type { Command, CommandReceipt, Reward, Workspace } from "../../lib/yutai/contracts";
const date = "2026-09-10T00:00:00Z";
const owner = "00000000-0000-4000-8000-000000000001";
test("DB reward filters and table are read-only, including mobile and month rollover", async ({ page, context }) => {
  await page.clock.setFixedTime(new Date("2026-12-31T12:00:00Z"));
  const base: Reward = { id: "today", title: "当日期限", company: "B", track_mode: "count", initial_value: 2, remaining_value: 1,
    expires_on: "2026-12-31", unit_yen: null, memo: "検索メモ", link: null, archived_at: null, profile_id: null, cycle_id: null,
    revision: 1, created_at: date, updated_at: date };
  const rewards: Reward[] = [base, { ...base, id: "later", title: "来年期限", company: "A", expires_on: "2027-01-01", unit_yen: 0 },
    { ...base, id: "old", title: "期限切れ優待", expires_on: "2026-12-30", track_mode: "amount", remaining_value: 0.25 },
    { ...base, id: "none", title: "期限なし優待", expires_on: null }, { ...base, id: "used", title: "使用済み優待", remaining_value: 0 },
    { ...base, id: "archived", title: "保存した優待", archived_at: date }];
  const before = JSON.stringify(rewards); let writes = 0;
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.addInitScript(() => { localStorage.setItem("mini-tools:benefits:v2", "keep-old"); localStorage.setItem("other-tool", "keep-other"); });
  await page.route("**/api/sync**", route => { if (route.request().method() !== "GET") writes++; return route.fulfill({ json: { items: [] } }); });
  await page.route("https://yutai-test.supabase.co/**", async route => {
    if (route.request().url().includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    if (!route.request().url().endsWith("stock_notes_get_yutai_workspace")) { writes++; await route.fulfill({ json: {} }); return; }
    await route.fulfill({ json: { schema_version: 1, selected_month: 1, as_of: date,
      counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: rewards.length, reward_events: 0, selections: 0, effective_selections: 0 },
      profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], rewards, reward_events: [], selections: [], effective_selections: [] } });
  });
  await page.goto("/tools/yutai-expiry");
  await expect(page.getByRole("button", { name: "すべて (4)", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "期限切れ (1)", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1); await expect(page.getByRole("article", { name: "期限切れ優待" })).toBeVisible();
  await page.getByRole("button", { name: "来月以降 (1)", exact: true }).click();
  await expect(page.getByRole("article", { name: "来年期限" })).toBeVisible();
  await page.getByRole("button", { name: "期限未設定 (1)", exact: true }).click();
  await expect(page.getByRole("article", { name: "期限なし優待" })).toBeVisible();
  await page.getByRole("button", { name: "全期限を表示", exact: true }).click();
  await page.getByLabel("使用済みを含む").uncheck(); await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByLabel("期限月", { exact: true }).fill("2027-01"); await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "全期限を表示", exact: true }).click();
  await page.getByRole("button", { name: "表表示", exact: true }).click();
  const table = page.getByRole("table", { name: "優待残高一覧" });
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "来年期限 A" }) }).getByRole("cell", { name: "0円", exact: true })).toBeVisible();
  await page.getByLabel("並べ替え", { exact: true }).selectOption("companyAsc");
  await expect(table.getByRole("rowheader").first()).toContainText("来年期限");
  await page.getByLabel("検索", { exact: true }).fill("存在しない");
  await expect(page.getByText("条件に一致する優待はありません。検索や期限の条件を変更してください。")).toBeVisible();
  await page.getByLabel("検索", { exact: true }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".tmp/yutai-expiry-table-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.clock.setFixedTime(new Date("2027-01-01T12:00:00Z")); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "期限切れ (2)", exact: true })).toBeVisible();
  expect(writes).toBe(0); expect(JSON.stringify(rewards)).toBe(before);
  expect(await page.evaluate(() => [localStorage.getItem("mini-tools:benefits:v2"), localStorage.getItem("other-tool")])).toEqual(["keep-old", "keep-other"]);
});
for (const disrupted of [false, true]) {
test(`reward lifecycle preserves history and old storage (disrupted: ${disrupted})`, async ({ page, context }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const other: Reward = { id: "other", title: "別の優待", company: "別会社", track_mode: "amount", initial_value: 20, remaining_value: 15,
    expires_on: null, unit_yen: null, memo: "保持", link: null, archived_at: null, profile_id: null, cycle_id: null,
    revision: 1, created_at: date, updated_at: date };
  const otherEvent: Workspace["reward_events"][number] = { id: "other-event", reward_id: "other", track_mode: "amount", event_type: "consumed", delta_value: -5, occurred_at: date, created_at: date, note: "保持する履歴" };
  const rewards: Reward[] = [{ ...other }];
  let events = [{ ...otherEvent }];
  const writes: Command[] = [];
  const receipts = new Map<string, CommandReceipt>();
  let conflict = disrupted;
  let lost = false;
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer",
    user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.addInitScript(() => {
    for (const key of ["mini-tools:benefits:v2", "benefits-tracker-items-v1", "benefits-tracker-items", "mini-tools:benefits"]) localStorage.setItem(key, "legacy-sentinel");
  });
  let legacySyncCalls = 0;
  await page.route("**/api/sync**", route => { legacySyncCalls++; return route.fulfill({ json: { items: [] } }); });
  await page.route("https://yutai-test.supabase.co/**", async route => {
    if (route.request().url().includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    const args = route.request().postDataJSON();
    if (route.request().url().endsWith("stock_notes_record_yutai_command")) {
      const command = args.p_input as Command;
      writes.push(command);
      const receipt = receipts.get(command.request_id);
      if (receipt) { await route.fulfill({ json: { ...receipt, replayed: true } }); return; }
      let target = rewards.find(r => "id" in command.target && r.id === command.target.id);
      if (conflict && command.command_type === "update_reward") { conflict = false; target!.memo = "他端末の更新"; target!.revision++; }
      if (target && command.expected_revision !== target.revision) { await route.fulfill({ status: 409, json: { code: "40001", message: "REVISION_CONFLICT" } }); return; }
      if (command.command_type === "create_reward") {
        target = { ...command.payload, id: "new", profile_id: null, cycle_id: null, company: command.payload.company ?? "", expires_on: command.payload.expires_on ?? null,
          unit_yen: command.payload.unit_yen ?? null, memo: command.payload.memo ?? "", link: command.payload.link ?? null,
          remaining_value: command.payload.initial_value, archived_at: null, revision: 0, created_at: date, updated_at: date };
        rewards.push(target);
      } else if (command.command_type === "update_reward") Object.assign(target!, command.payload);
      else if (["consume_reward", "restock_reward", "adjust_reward_balance"].includes(command.command_type)) {
        const value = (command.payload as { value: number }).value;
        const delta = command.command_type === "consume_reward" ? -value : command.command_type === "restock_reward" ? value : value - target!.remaining_value;
        target!.remaining_value = Math.round((target!.remaining_value + delta) * 100) / 100;
        events.push({ id: `event-${writes.length}`, reward_id: target!.id, track_mode: target!.track_mode, delta_value: delta,
          event_type: command.command_type === "consume_reward" ? "consumed" : command.command_type === "restock_reward" ? "restocked" : "adjusted", occurred_at: date, created_at: date, note: command.note ?? null });
      } else if (command.command_type === "remove_reward_event") {
        const event = events.find(e => e.id === command.payload.event_id)!;
        target!.remaining_value -= event.delta_value;
        events = events.filter(e => e.id !== event.id);
      } else if (command.command_type === "set_reward_archived") target!.archived_at = command.payload.archived ? date : null;
      else if (command.command_type === "change_reward_mode") {
        Object.assign(target!, { track_mode: command.payload.track_mode, initial_value: command.payload.value, remaining_value: command.payload.value, unit_yen: command.payload.unit_yen });
        events = events.filter(e => e.reward_id !== target!.id);
      } else if (command.command_type === "delete_reward") {
        rewards.splice(rewards.indexOf(target!), 1); events = events.filter(e => e.reward_id !== target!.id);
      } else throw new Error(`Unexpected command ${command.command_type}`);
      target!.revision++;
      const deleted = command.command_type === "delete_reward";
      const result: CommandReceipt = { schema_version: 1, command_type: command.command_type, request_id: command.request_id, target_id: target!.id, revision: deleted ? null : target!.revision, event_id: "audit", before: null, after: deleted ? null : {}, replayed: false };
      receipts.set(command.request_id, result);
      if (disrupted && !lost && command.command_type === "consume_reward") { lost = true; await route.abort("failed"); return; }
      await route.fulfill({ json: result }); return;
    }
    await route.fulfill({ json: { schema_version: 1, selected_month: args.p_month, as_of: date,
      counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: rewards.length, reward_events: events.length, selections: 0, effective_selections: 0 },
      profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], rewards, reward_events: events, selections: [], effective_selections: [] } });
  });
  await page.goto("/tools/yutai-expiry");
  await expect(page.getByText("Supabase接続の検証モード（残高・期限）")).toBeVisible();
  await page.getByRole("button", { name: "優待を追加", exact: true }).click();
  await page.getByLabel("優待名", { exact: true }).fill("検証優待");
  await page.getByLabel("初期残高", { exact: true }).fill("10");
  await page.getByLabel("1枚の額面", { exact: true }).fill("500");
  await page.getByLabel("期限日", { exact: true }).fill("2026-12-31");
  await page.getByRole("button", { name: "優待を保存", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "優待編集" })).toHaveCount(0);
  const card = page.getByRole("article", { name: "検証優待", exact: true });
  await expect(card.getByText("残高: 10枚 / 初期: 10枚", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "表表示", exact: true }).click();
  await page.getByText("検証優待の詳細・操作", { exact: true }).click();
  await card.getByRole("button", { name: "優待を編集" }).click();
  await page.getByLabel("優待メモ").fill("追記メモ");
  await page.getByRole("button", { name: "優待を保存", exact: true }).click();
  if (disrupted) {
    await expect(page.getByRole("button", { name: "最新データを確認して編集をやり直す" })).toBeVisible();
    expect(rewards[1].memo).toBe("他端末の更新");
    await page.getByRole("button", { name: "最新データを確認して編集をやり直す" }).click();
    await expect(page.getByRole("dialog", { name: "優待編集" })).toHaveCount(0);
    await card.getByRole("button", { name: "優待を編集" }).click();
    await expect(page.getByLabel("優待メモ")).toHaveValue("他端末の更新");
    await page.getByLabel("優待メモ").fill("確認後の追記");
    await page.getByRole("button", { name: "優待を保存", exact: true }).click();
  }
  await page.getByRole("button", { name: "カード表示", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "優待編集" })).toHaveCount(0);
  await card.getByRole("button", { name: "優待を編集" }).click();
  await page.getByLabel("優待メモ").fill("未保存の入力");
  rewards[1].memo = "バックグラウンド更新"; rewards[1].revision++;
  await page.getByRole("button", { name: "最新データを再取得", exact: true }).click();
  await expect(card.getByText("バックグラウンド更新", { exact: true })).toBeVisible();
  await expect(page.getByLabel("優待メモ")).toHaveValue("未保存の入力");
  await card.getByRole("button", { name: "優待を編集" }).click();
  await expect(page.getByLabel("優待メモ")).toHaveValue("バックグラウンド更新");
  await page.getByRole("dialog", { name: "優待編集" }).getByRole("button", { name: "閉じる", exact: true }).click();
  await card.getByRole("button", { name: "使う", exact: true }).click();
  await page.getByLabel("操作する値").fill("11");
  await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(page.getByText("残高を超えて使うことはできません。", { exact: true })).toBeVisible();
  expect(writes.filter(c => c.command_type === "consume_reward")).toHaveLength(0);
  await page.getByLabel("操作する値").fill("2");
  await page.getByRole("button", { name: "操作を保存" }).click();
  if (disrupted) {
    await expect(page.getByText(/今回の保存結果は不明/)).toBeVisible();
    await expect(page.getByRole("button", { name: "操作を保存" })).toBeDisabled();
    await page.getByRole("button", { name: "同じ要求を再確認・続行" }).click();
    const requests = writes.filter(c => c.command_type === "consume_reward");
    expect(requests[0]).toEqual(requests[1]);
  }
  await expect(card.getByText("残高: 8枚 / 初期: 10枚", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  await card.getByRole("button", { name: "補充", exact: true }).click();
  await page.getByLabel("操作する値").fill("3"); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(card.getByText("残高: 11枚 / 初期: 10枚", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  await card.getByRole("button", { name: "残高訂正", exact: true }).click();
  await page.getByLabel("操作する値").fill("9"); await page.getByLabel("理由・利用メモ").fill("棚卸し");
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(card.getByText("残高: 9枚 / 初期: 10枚", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  await card.getByText("利用履歴（3件）", { exact: true }).click();
  await card.getByRole("button", { name: "この履歴を取り消す" }).first().click();
  await page.getByLabel("理由・利用メモ").fill("取消確認");
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  expect(rewards[1].remaining_value).toBe(11);
  page.once("dialog", d => d.accept()); await card.getByRole("button", { name: "アーカイブ", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole("checkbox", { name: "アーカイブを含む" }).check();
  await expect(card.getByRole("button", { name: "使う", exact: true })).toBeDisabled();
  page.once("dialog", d => d.accept()); await card.getByRole("button", { name: "アーカイブ解除", exact: true }).click();
  await expect(card.getByRole("button", { name: "使う", exact: true })).toBeEnabled();
  await card.getByRole("button", { name: "管理単位を変更" }).click();
  await page.getByLabel("操作する値").fill("123.45"); await page.getByLabel("理由・利用メモ").fill("金額へ変更");
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(card.getByText("残高: 123.45円 / 初期: 123.45円", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  expect(events.filter(e => e.reward_id === "new")).toHaveLength(0);
  await card.getByRole("button", { name: "使う", exact: true }).click();
  await page.getByLabel("操作する値").fill("0.29"); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(card.getByText("残高: 123.16円 / 初期: 123.45円", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "残高操作" })).toHaveCount(0);
  await page.screenshot({ path: ".tmp/yutai-rewards-connected.png", fullPage: true });
  await card.getByRole("button", { name: "優待を削除", exact: true }).click();
  await page.getByLabel("理由・利用メモ").fill("合成記録を削除");
  page.once("dialog", d => d.dismiss()); await page.getByRole("button", { name: "操作を保存" }).click();
  expect(writes.filter(c => c.command_type === "delete_reward")).toHaveLength(0);
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "操作を保存" }).click();
  await expect(card).toHaveCount(0);
  expect(rewards).toEqual([other]); expect(events).toEqual([otherEvent]);
  expect(await page.evaluate(() => ["mini-tools:benefits:v2", "benefits-tracker-items-v1", "benefits-tracker-items", "mini-tools:benefits"].map(key => localStorage.getItem(key)))).toEqual(Array(4).fill("legacy-sentinel"));
  expect(legacySyncCalls).toBe(0); expect(errors).toEqual([]);
});
}
test("rewards signed out never reads legacy private data", async ({ page }) => {
  await page.goto("/tools/yutai-expiry");
  await expect(page.getByText("Supabaseへのログインが必要です。")).toBeVisible();
  await expect(page.getByRole("button", { name: "優待を追加", exact: true })).toHaveCount(0);
});
