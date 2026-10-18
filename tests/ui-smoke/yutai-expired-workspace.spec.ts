import { expect, test } from "@playwright/test";
import type { Workspace } from "../../lib/yutai/contracts";

test("calendar retains expired history while switching months without writes", async ({ page, context }) => {
  const date = "2026-09-09T00:00:00Z";
  const owner = "00000000-0000-4000-8000-000000000001";
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000,
    expires_in: 3600, token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  const history: Workspace["reward_events"] = [{ id: "expired", reward_id: "reward", track_mode: "count",
    event_type: "expired", delta_value: -2, occurred_at: date, note: null, created_at: date }];
  const before = JSON.stringify(history);
  const reads: number[] = []; const writes: string[] = []; const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  await page.route("**/api/sync**", route => {
    if (route.request().method() !== "GET") writes.push("sync");
    return route.fulfill({ json: { items: [] } });
  });
  await page.route("https://yutai-test.supabase.co/**", route => {
    if (route.request().url().includes("/auth/")) return route.fulfill({ json: session.user });
    if (!route.request().url().endsWith("stock_notes_get_yutai_workspace")) {
      writes.push("unexpected RPC"); return route.fulfill({ status: 500, json: {} });
    }
    const month = route.request().postDataJSON().p_month as number; reads.push(month);
    const workspace: Workspace = { schema_version: 1, selected_month: month, as_of: date,
      profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], selections: [], effective_selections: [],
      rewards: [{ id: "reward", profile_id: null, cycle_id: null, title: "expired fixture", company: "",
        expires_on: "2026-08-31", track_mode: "count", initial_value: 2, remaining_value: 0, unit_yen: null,
        archived_at: null, memo: "", link: null, revision: 1, created_at: date, updated_at: date }],
      reward_events: history,
      counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: 1, reward_events: 1, selections: 0, effective_selections: 0 } };
    return route.fulfill({ json: workspace });
  });
  await page.goto("/tools/yutai-candidates?month=2026-09");
  await expect(page.getByRole("heading", { name: "権利確定月で優待銘柄を探す" })).toBeVisible();
  await expect(page.getByText("クラウド保存", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: /^8月/ }).click();
  await expect(page).toHaveURL(/month=2026-08/);
  await expect(page.getByText("クラウド保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^9月/ }).click();
  await expect(page).toHaveURL(/month=2026-09/);
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(reads).toContain(8); expect(reads).toContain(9);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
  expect(JSON.stringify(history)).toBe(before);
});
