import { expect, test } from "@playwright/test";

const owner = "00000000-0000-4000-8000-000000000001";
const date = "2026-09-18T00:00:00Z";

test("entitlement usage retries the same request and refreshes history without a page reload", async ({ page, context }) => {
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: owner, exp: 4_000_000_000, role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  const session = { access_token: token, refresh_token: "synthetic", expires_at: 4_000_000_000, expires_in: 3600,
    token_type: "bearer", user: { id: owner, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-yutai-test-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: "http://127.0.0.1:3146" }]);
  const writes: Array<Record<string, unknown>> = [];
  let saved = false;
  let rejectNext = false;
  let loads = 0;
  await page.route("**/api/sync**", route => route.fulfill({ json: { items: [] } }));
  await page.route("https://yutai-test.supabase.co/**", async route => {
    const url = route.request().url();
    if (url.includes("/auth/")) return route.fulfill({ json: session.user });
    if (url.endsWith("stock_notes_get_yutai_reward_ledger_v2")) return route.fulfill({ json: {
      schema_version: 2, as_of: date, today: "2026-09-18", counts: { accounts: 0, entitlements: 1, unassigned_rewards: 0 },
      accounts: [], unassigned_rewards: [], entitlements: [{ id: "entitlement-1", profile_id: null, cycle_id: null, account_id: null,
        benefit_kind: "discount", status: "eligible", native_quantity: null, native_unit: null, face_value_yen: null,
        user_value_yen: null, selected_option: null, claimed_at: null, activated_at: null, fulfilled_at: null,
        coverage_state: "native_complete", memo: "割引優待", revision: 1, deadlines: [] }],
    } });
    if (url.endsWith("stock_notes_get_yutai_reward_history_v1")) {
      loads++;
      return route.fulfill({ json: { schema_version: 1, as_of: date, next_before: null, items: saved ? [{
        event_id: "event-1", occurred_at: date, event_type: "entitlement_usage", event_category: "used",
        reward_id: "entitlement-1", reward_title: "割引優待", company: "テスト会社", account_id: null, account_key: null,
        display_title: "割引優待", native_delta: -1, native_unit: "count", unit_yen: null, yen_delta: -2000,
        event_note: null, operation_id: null, operation_type: null, operation_source: null, operation_note: null,
        merchant_name: "テスト店", merchant_amount_native: null, unattributed_amount_native: null, detail: null,
      }] : [] } });
    }
    if (url.endsWith("stock_notes_record_yutai_v2_command")) {
      const wire = route.request().postDataJSON().p_input as Record<string, unknown>;
      writes.push(wire);
      if (rejectNext) {
        rejectNext = false;
        return route.fulfill({ status: 409, json: { code: "40001", message: "REVISION_CONFLICT" } });
      }
      saved = true;
      if (writes.length === 1) return route.abort("failed");
      return route.fulfill({ json: { schema_version: 2, request_id: wire.request_id, replayed: true,
        command_type: wire.command_type, target_id: "entitlement-1", revision: 2 } });
    }
    return route.fulfill({ json: { schema_version: 1, selected_month: 1, as_of: date,
      counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0,
        selections: 0, effective_selections: 0 }, profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [],
      rewards: [], reward_events: [], selections: [], effective_selections: [] } });
  });
  let pageLoads = 0;
  page.on("load", () => { pageLoads++; });
  await page.goto("/tools/yutai-expiry");
  await page.getByRole("tab", { name: "履歴" }).click();
  await expect(page.getByText("利用 0件")).toBeVisible();
  await page.getByText("利用実績を記録").click();
  await page.getByLabel("円換算価値").fill("2000");
  await page.getByRole("button", { name: "利用実績を保存" }).click();
  await expect(page.getByRole("button", { name: "同じ要求で再確認" })).toBeVisible();
  await page.getByRole("button", { name: "同じ要求で再確認" }).click();
  await expect(page.getByText("利用 1件")).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(loads).toBeGreaterThan(1);
  expect(pageLoads).toBe(1);
  rejectNext = true;
  await page.getByLabel("円換算価値").fill("1000");
  await page.getByRole("button", { name: "利用実績を保存" }).click();
  await expect(page.getByRole("button", { name: "最新台帳を再取得" })).toBeVisible();
  await page.getByRole("button", { name: "最新台帳を再取得" }).click();
  await expect(page.getByRole("button", { name: "利用実績を保存" })).toBeEnabled();
});
