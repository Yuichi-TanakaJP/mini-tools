import { expect, test } from "@playwright/test";
import { collections, createWorkspaceExport, parseWorkspaceExport } from "../../lib/yutai/transfer";
import { snapshotChanges, snapshotOf, snapshotWorkspace } from "../../lib/yutai/restore-contracts";

for (const lostResponse of [false, true]) test(`restore confirmation, backup and readback (lost response=${lostResponse})`, async ({ page, context }) => {
  const owner = "00000000-0000-4000-8000-000000000001", planId = "00000000-0000-4000-8000-000000000002";
  const date = new Date().toISOString(), project = "https://yutai-test.supabase.co";
  const before = snapshotOf(snapshotWorkspace({ ...Object.fromEntries(collections.map(k => [k, []])),
    tags: [{ id: owner, name: "変更前のタグ", revision: 1, created_at: date, updated_at: date }] }));
  const after = structuredClone(before); after.tags[0].name = "復元したタグ"; after.tags[0].revision = 2;
  const preview = { schema_version: 1, plan_id: planId, replayed: false, expires_at: new Date(Date.now() + 600_000).toISOString(),
    before, after, changes: snapshotChanges(before, after), confirmation_hash: "a".repeat(64) };
  const receipt = { schema_version: 1, plan_id: planId, replayed: false, verified: true, after, applied_at: date };
  const file = JSON.stringify(await createWorkspaceExport(snapshotWorkspace(after), { owner_id: owner, project_url: project }, date));
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.addInitScript(() => { localStorage.setItem("other-tool", "unchanged"); });
  let applies = 0, previews = 0, reads = 0, gets = 0;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/sync**", route => route.fulfill({ json: { items: [] } }));
  await page.route(`${project}/**`, async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) { await route.fulfill({ json: session.user }); return; }
    if (url.endsWith("stock_notes_get_yutai_workspace")) {
      reads++; const w = snapshotWorkspace(applies ? after : before); w.selected_month = route.request().postDataJSON().p_month;
      await route.fulfill({ json: w }); return;
    }
    if (url.endsWith("stock_notes_preview_yutai_restore")) {
      previews++; expect(route.request().postDataJSON().p_input.workspace.tags).toEqual(after.tags);
      await route.fulfill({ json: preview }); return;
    }
    if (url.endsWith("stock_notes_apply_yutai_restore")) {
      applies++; expect(route.request().postDataJSON()).toEqual({ p_plan_id: planId, p_confirmation_hash: preview.confirmation_hash });
      if (lostResponse) await route.abort("failed"); else await route.fulfill({ json: receipt }); return;
    }
    if (url.endsWith("stock_notes_get_yutai_restore")) {
      gets++; expect(route.request().postDataJSON()).toEqual({ p_plan_id: planId });
      await route.fulfill({ json: { schema_version: 1, preview, receipt: applies ? receipt : null, status: applies ? "applied" : "prepared" } }); return;
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  await page.goto("/tools/data-transfer");
  const panel = page.getByRole("region", { name: "優待DBの復元", exact: true });
  await expect(panel).toBeVisible();
  await panel.getByLabel("復元用の優待DBファイル").setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await panel.getByLabel("復元理由").fill("合成データによる復元テスト");
  await panel.getByRole("button", { name: "復元の差分を確認する" }).click();
  await expect(panel.getByText("差分を確認し、変更前バックアップを保存してください。まだ復元していません。")).toBeVisible();
  expect(applies).toBe(0); expect(previews).toBe(1);
  await panel.locator("summary").filter({ hasText: "タグ: 追加" }).click();
  await panel.locator("summary").filter({ hasText: `変更: ${owner}` }).click();
  await expect(panel.getByText('"name": "変更前のタグ"', { exact: false })).toBeVisible();
  const apply = panel.getByRole("button", { name: "確認した内容で復元する" }); await expect(apply).toBeDisabled();
  const downloading = page.waitForEvent("download"); await panel.getByRole("button", { name: "変更前バックアップをダウンロード" }).click();
  const download = await downloading; expect(download.suggestedFilename()).toContain(planId);
  const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const backup = await parseWorkspaceExport(Buffer.concat(chunks).toString("utf8")); expect(backup.workspace.tags).toEqual(before.tags);
  await expect(apply).toBeDisabled(); await panel.getByRole("checkbox").check(); await expect(apply).toBeEnabled();
  const readsBeforeApply = reads; page.once("dialog", d => d.accept()); await apply.click();
  if (lostResponse) {
    await expect(panel.getByRole("alert")).toContainText("復元結果を確定できません");
    await expect(apply).toBeDisabled();
    await panel.getByRole("button", { name: "同じプランの結果を確認する" }).click();
  }
  await expect(panel.getByText("復元完了。DBを再取得し、全8種類・全フィールドの一致を確認しました。")).toBeVisible();
  expect(applies).toBe(1); expect(reads).toBeGreaterThan(readsBeforeApply);
  await page.screenshot({ path: `.tmp/yutai-restore-${lostResponse ? "recovered" : "verified"}.png`, fullPage: true });
  // Recovery after a full reload uses the downloaded plan ID, never another apply.
  await page.reload(); await expect(panel).toBeVisible();
  await panel.getByLabel("保存したプランID").fill(planId);
  await panel.getByRole("button", { name: "同じプランの結果を確認する" }).click();
  await expect(panel.getByText("復元完了。DBを再取得し、全8種類・全フィールドの一致を確認しました。")).toBeVisible();
  expect(gets).toBe(lostResponse ? 2 : 1); expect(applies).toBe(1); expect(previews).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("other-tool"))).toBe("unchanged"); expect(errors).toEqual([]);
});
