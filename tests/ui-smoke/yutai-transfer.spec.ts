import { expect, test } from "@playwright/test";
import { parseWorkspaceExport } from "../../lib/yutai/transfer";

test("DB export download/read-back/diff is read-only and never uses stale cache", async ({ page, context }) => {
  const date = "2026-09-09T00:00:00.123456Z", owner = "00000000-0000-4000-8000-000000000001";
  const row = { id: "p", revision: 1, created_at: date, updated_at: date };
  const profile = { ...row, stock_code: "1234", display_name: "非表示の銘柄", portfolio_instrument_id: null, cross_strategy: "未設定", priority: 2,
    memo: "DBメモ", active: false, one_share_started_on: null, one_share_started_legacy_text: "開始年不明", entry_timing: null,
    default_preparation_months_before: null, tenure_rule: null, related_url: null, official_benefit_url: null };
  const w = { schema_version: 1, selected_month: 1, as_of: date,
    counts: { profiles: 1, month_states: 2, cycles: 2, tags: 1, profile_tags: 1, rewards: 1, reward_events: 1, selections: 2, effective_selections: 0 },
    profiles: [profile], month_states: [8, 9].map(month => ({ ...row, id: `m${month}`, profile_id: "p", entitlement_month: month,
      preparation_months_before: month === 8 ? null : 0, required_shares: month === 8 ? null : 100, benefit_value_yen: month === 8 ? 0 : 1234.5,
      long_term_required: false, long_term_benefit: true, month_memo: "keep" })),
    cycles: [2025, 2026].map(year => ({ ...row, id: `c${year}`, profile_id: "p", entitlement_year: year, entitlement_month: 9,
      status: "received", planned_at: null, prepared_at: `${year}-08-01T00:00:00.123456Z`, rights_secured_at: null, settled_at: null, received_at: null, skipped_at: null,
      quantity: 100, account_label: null, note: "履歴" })),
    tags: [{ ...row, id: "tag", name: "test" }], profile_tags: [{ profile_id: "p", tag_id: "tag", created_at: date }],
    rewards: [{ ...row, id: "reward", title: "優待", company: "test", profile_id: "p", cycle_id: "c2026", expires_on: null,
      track_mode: "amount", initial_value: 100, remaining_value: 99.5, unit_yen: null, memo: "keep", link: null, archived_at: date }],
    reward_events: [{ id: "event", reward_id: "reward", track_mode: "amount", event_type: "consumed", delta_value: -0.5, occurred_at: date, note: "keep", created_at: date }],
    selections: [null, 9].map(month => ({ ...row, id: `s${month}`, stock_code: "1234", entitlement_month: month, selection_status: month ? "unreviewed" : "picked" })), effective_selections: [],
  };
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.addInitScript(() => { localStorage.setItem("yutai_memo_items_v1", "legacy-sentinel"); localStorage.setItem("other-tool", "preserve"); });
  let reads = 0, writes = 0, failRead = false;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/sync**", route => { if (route.request().method() !== "GET") writes++; return route.fulfill({ json: { items: [] } }); });
  await page.route("https://yutai-test.supabase.co/**", async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    if (url.endsWith("stock_notes_get_yutai_workspace")) {
      reads++;
      await route.fulfill(failRead ? { status: 503, json: { message: "unavailable" } } : { json: w }); return;
    }
    if (route.request().method() !== "GET") writes++;
    await route.fulfill({ json: [] });
  });
  await page.goto("/tools/data-transfer");
  const panel = page.getByRole("region", { name: "優待DBの出力・照合", exact: true });
  const downloadButton = panel.getByRole("button", { name: "DB全件JSONをダウンロード" });
  await expect(downloadButton).toBeVisible();
  const initialReads = reads;
  const downloading = page.waitForEvent("download"); await downloadButton.click(); const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toMatch(/^mini-tools-yutai-db-/);
  const stream = await downloaded.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8"), file = await parseWorkspaceExport(text);
  expect(file.workspace).toEqual(w); expect(file.source.owner_id).toBe(owner); expect(reads).toBeGreaterThan(initialReads);
  expect(text).not.toContain(token); expect(text).not.toContain("legacy-sentinel"); expect(text).not.toContain("other-tool");
  await panel.getByLabel("優待DBファイルを読み込む（照合のみ）").setInputFiles({ name: "db.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await panel.getByRole("button", { name: "現在のDBと全件照合" }).click();
  await expect(panel.getByText("全8種類のデータが一致しました。DBへの書き込みは行っていません。")).toBeVisible();
  profile.memo = "別端末の新しいメモ"; profile.revision++;
  await panel.getByRole("button", { name: "現在のDBと全件照合" }).click();
  await expect(panel.getByText("差分があります。照合のみで、DBへの書き込みは行っていません。")).toBeVisible();
  const memoRow = panel.getByRole("row").filter({ hasText: "銘柄メモ" });
  await expect(memoRow.getByRole("cell").last()).toHaveText("1");
  expect(profile.memo).toBe("別端末の新しいメモ");
  const tampered = JSON.parse(text); tampered.workspace.profiles[0].memo = "tampered";
  await panel.getByLabel("優待DBファイルを読み込む（照合のみ）").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(tampered)) });
  await expect(panel.getByRole("alert")).toContainText("チェックサム");
  await expect(panel.getByRole("button", { name: "現在のDBと全件照合" })).toHaveCount(0);
  const downloads: string[] = []; page.on("download", d => downloads.push(d.suggestedFilename()));
  failRead = true; await downloadButton.click();
  await expect(panel.getByRole("alert").last()).toContainText("DBの再取得に失敗しました");
  await expect(downloadButton).toBeEnabled(); expect(downloads).toEqual([]);
  expect(writes).toBe(0);
  expect(await page.evaluate(() => [localStorage.getItem("yutai_memo_items_v1"), localStorage.getItem("other-tool")])).toEqual(["legacy-sentinel", "preserve"]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".tmp/yutai-transfer.png", fullPage: true });
});

test("signed-out DB transfer does not offer exporting old private data as DB data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("yutai_memo_items_v1", "legacy-private"));
  await page.goto("/tools/data-transfer");
  const panel = page.getByRole("region", { name: "優待DBの出力・照合", exact: true });
  await expect(panel.getByText("Supabaseへのログインが必要です。")).toBeVisible();
  await expect(panel.getByRole("button", { name: "DB全件JSONをダウンロード" })).toHaveCount(0);
  await expect(panel.getByText("legacy-private")).toHaveCount(0);
});
