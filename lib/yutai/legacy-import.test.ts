import { describe, expect, it } from "vitest";
import { convertLegacyBenefits, convertLegacyInput } from "./legacy-import";
import { createWorkspaceExport, parseWorkspaceExport } from "./transfer";
import type { Workspace } from "./contracts";
const date = "2026-09-01T00:00:00Z";
const workspace: Workspace = { schema_version: 1, selected_month: 1, as_of: date,
  counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0, selections: 0, effective_selections: 0 },
  profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], rewards: [], reward_events: [], selections: [], effective_selections: [] };
const source = { owner_id: "00000000-0000-4000-8000-000000000001", project_url: "https://test.supabase.co" };
const row = { id: "old", title: "テスト", company: "会社", trackMode: "count", unitYen: 500, initial: 3, remaining: 2,
  history: [{ at: date, deltaQty: -1, note: "利用" }], expiresOn: "2026-12-31", archivedAt: null, isUsed: false, createdAt: date, updatedAt: date };
describe("legacy benefit conversion", () => {
  it("converts memo, month values, tags and dated history without changing other collections", async () => {
    const data = {
      yutai_memo_items_v1: JSON.stringify([{ id: "m", code: "1234", name: "メモ", months: [9], tagIds: ["t"], crossType: "未設定", priority: 2, memo: "本文", acquired: true, acquiredMarkedAt: date, acquiredEntitlementMonthKey: "2026-09", createdAt: date, updatedAt: date }]),
      yutai_memo_tags_v1: JSON.stringify([{ id: "t", name: "タグ", createdAt: 0 }]),
      monthly_yutai_card_memos_v1: JSON.stringify({ "1234:9": { requiredShares: 100, benefitValueYen: 1500, preparationMonthsBefore: 0 } }),
      monthly_yutai_picks_v1: JSON.stringify(["1234"]), unrelated: "retain-outside-scope",
    };
    const input = JSON.stringify({ schema: "mini-tools-localstorage-backup", version: 1, data });
    const converted = await convertLegacyInput(input, await createWorkspaceExport(workspace, source, date));
    expect(converted.workspace.month_states[0]).toMatchObject({ required_shares: 100, benefit_value_yen: 1500, preparation_months_before: 0 });
    expect(converted.workspace.cycles[0]).toMatchObject({ entitlement_year: 2026, entitlement_month: 9, prepared_at: date });
    expect(converted.workspace.profile_tags).toHaveLength(1);
    expect(converted.workspace.selections[0]).toMatchObject({ entitlement_month: null, selection_status: "picked" });
    expect((await convertLegacyInput(input, converted)).workspace).toEqual(converted.workspace);
  });
  it("does not invent the missing entitlement year", async () => {
    const input = JSON.stringify({ schema: "mini-tools-localstorage-backup", version: 1, data: { yutai_memo_items_v1: JSON.stringify([
      { id: "m", code: "1234", name: "メモ", months: [9], tagIds: [], acquired: true, acquiredMarkedAt: date, createdAt: date, updatedAt: date },
    ]) } });
    await expect(convertLegacyInput(input, await createWorkspaceExport(workspace, source, date))).rejects.toThrow("権利年月");
  });
  it("preserves source dates and history, makes stable IDs and reimport is a no-op", async () => {
    const current = await createWorkspaceExport(workspace, source, date);
    const imported = await convertLegacyBenefits(JSON.stringify([row]), current);
    expect(imported.workspace.reward_events[0]).toMatchObject({ event_type: "adjusted", delta_value: -1, occurred_at: date });
    expect((await parseWorkspaceExport(JSON.stringify(imported))).workspace.rewards).toHaveLength(1);
    expect((await convertLegacyBenefits(JSON.stringify([row]), imported)).workspace).toEqual(imported.workspace);
    expect(current.workspace.rewards).toEqual([]);
  });
  it("rejects inconsistent balances, unknown fields and duplicate source IDs", async () => {
    const current = await createWorkspaceExport(workspace, source, date);
    for (const rows of [[{ ...row, remaining: 1 }], [{ ...row, unknown: 2 }], [row, row], [{ ...row, history: [{ at: date, deltaQty: -1.5 }] }]]) {
      await expect(convertLegacyBenefits(JSON.stringify(rows), current)).rejects.toThrow();
    }
  });
  it("does not overwrite a changed imported record or duplicate migrated names", async () => {
    const imported = await convertLegacyBenefits(JSON.stringify([row]), await createWorkspaceExport(workspace, source, date));
    imported.workspace.rewards[0].memo = "新しいメモ";
    await expect(convertLegacyBenefits(JSON.stringify([row]), imported)).rejects.toThrow();
    imported.workspace.rewards[0].id = "different";
    await expect(convertLegacyBenefits(JSON.stringify([row]), imported)).rejects.toThrow();
  });
});
