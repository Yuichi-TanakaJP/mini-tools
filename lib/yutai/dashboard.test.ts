import { describe, expect, it } from "vitest";
import { buildMemoEditDraft } from "@/app/tools/_shared/yutai-memo-edit";
import { dashboardProjection, dashboardSelection, dashboardSelectionCommand, dashboardCalendarCells, dashboardInlineEdit, dashboardEditMemo } from "./dashboard";
import type { Cycle, Workspace } from "./contracts";

const date = "2026-09-09T00:00:00Z";
function fixture(): Workspace {
  return { schema_version: 1, selected_month: 1, as_of: date, counts: {},
    profiles: [{ id: "p", stock_code: "1234", display_name: "test", portfolio_instrument_id: null, cross_strategy: "未設定", priority: 2, memo: "keep", active: true,
      one_share_started_on: "2024-03-01", one_share_started_legacy_text: null, entry_timing: null, default_preparation_months_before: 5,
      tenure_rule: null, related_url: null, official_benefit_url: null, revision: 3, created_at: date, updated_at: date }],
    month_states: [8, 9].map(month => ({ id: `m${month}`, profile_id: "p", entitlement_month: month, preparation_months_before: month === 8 ? null : 0,
      required_shares: month === 8 ? 100 : 200, benefit_value_yen: 1234.5, long_term_required: false, long_term_benefit: true, month_memo: "keep", revision: 4, created_at: date, updated_at: date })),
    cycles: [], tags: [], profile_tags: [], rewards: [], reward_events: [],
    selections: [{ id: "global", stock_code: "1234", entitlement_month: null, selection_status: "picked", revision: 9, created_at: date, updated_at: date },
      { id: "s9", stock_code: "1234", entitlement_month: 9, selection_status: "unreviewed", revision: 2, created_at: date, updated_at: date }], effective_selections: [] };
}
function cycle(year: number, month: number, prepared = `${year}-07-01T00:00:00Z`): Cycle {
  return { id: `${year}:${month}`, profile_id: "p", entitlement_year: year, entitlement_month: month, status: "prepared", planned_at: null,
    prepared_at: prepared, rights_secured_at: null, settled_at: null, received_at: null, skipped_at: null, quantity: 100, account_label: null,
    note: "keep history", revision: 8, created_at: date, updated_at: date };
}
describe("dashboard DB adapter", () => {
  it("uses each row's month and explicit unreviewed overrides global picks", () => {
    const w = fixture();
    expect(dashboardSelection(w, "1234", 8)).toBe("picked");
    expect(dashboardSelection(w, "1234", 9)).toBe("unreviewed");
    expect(dashboardSelection(w, "9999", 9)).toBe("unreviewed");
    expect(dashboardSelectionCommand(w, "1234", 9, "passed")).toMatchObject({ target: { entitlement_month: 9 }, expected_revision: 2 });
    expect(dashboardSelectionCommand(w, "1234", 8, "passed").expected_revision).toBe(0);
    expect(() => dashboardSelection(w, "1234", 0)).toThrow();
    expect(() => dashboardSelectionCommand(w, "1234", 13, "picked")).toThrow();
    expect(w.selections[0].selection_status).toBe("picked");
  });
  it("projects independent month settings without profile-default fallback or fabricated zero", () => {
    const w = fixture(), p = dashboardProjection(w, 2026);
    expect(p.monthlyItems.map(m => [m.months, m.preparationMonthsBefore])).toEqual([[[8], undefined], [[9], 0]]);
    expect(p.cardMemos["1234:8"].requiredShares).toBe(100);
    expect(p.cardMemos["1234:9"].requiredShares).toBe(200);
    expect(p.memoItems[0].oneShareStartedAt).toBe("2024-03");
    w.profiles[0].one_share_started_on = null; w.profiles[0].one_share_started_legacy_text = "年不明";
    expect(dashboardProjection(w, 2026).memoItems[0].oneShareStartedAt).toBe("年不明");
  });
  it("retains each year and counts executed cycles, not cancelled or merely planned rows", () => {
    const w = fixture(); w.cycles = [cycle(2025, 8), cycle(2026, 8), { ...cycle(2026, 9), status: "cancelled" }];
    const p = dashboardProjection(w, 2026);
    expect(p.archivedItems.map(c => c.entitlementMonthKey)).toEqual(["2025-08", "2026-08"]);
    expect(p.monthlyItems[0].acquired).toBe(true);
    expect(p.monthlyItems[1].acquired).toBe(false);
    expect(dashboardProjection(w, 2027).monthlyItems[0].acquired).toBe(false);
  });
  it("builds month-specific bands and keeps execution year distinct from entitlement year", () => {
    const w = fixture(); w.cycles = [cycle(2027, 8, "2026-12-31T14:59:59Z")];
    const p = dashboardProjection(w, 2026).memoItems[0];
    const cells = dashboardCalendarCells(w, p, 2026, date);
    expect(cells[7]).toMatchObject({ entitlement: true, prepStart: false, band: false, acquiredPast: true });
    expect(cells[8]).toMatchObject({ entitlement: true, prepStart: true, band: true });
    expect(cells[11].prepCompleted).toBe(true);
    expect(dashboardCalendarCells(w, p, 2027, date)[11].prepCompleted).toBe(false);
  });
  it("keeps history visible after month registration removal and excludes inactive profiles from active list", () => {
    const w = fixture(); w.cycles = [cycle(2026, 8)]; w.month_states = w.month_states.filter(s => s.entitlement_month !== 8);
    const p = dashboardProjection(w, 2026);
    expect(dashboardCalendarCells(w, p.memoItems[0], 2026, date)[7]).toMatchObject({ entitlement: false, acquiredThisYear: true });
    w.profiles[0].active = false;
    expect(dashboardProjection(w, 2026).memoItems).toEqual([]);
    expect(dashboardProjection(w, 2026).archivedItems).toHaveLength(1);
  });
  it("inline edits only the intended profile/month and preserves captured revisions", () => {
    const w = fixture();
    expect(dashboardInlineEdit(w, "1234", "test", 9, { preparationMonthsBefore: "" })[0]([])).toMatchObject({ target: { id: "m9" }, payload: { preparation_months_before: null }, expected_revision: 4 });
    expect(dashboardInlineEdit(w, "1234", "test", 8, { crossType: "連続クロス" })[0]([])).toMatchObject({ target: { id: "p" }, payload: { cross_strategy: "連続クロス" }, expected_revision: 3 });
    expect(dashboardInlineEdit(w, "1234", "test", 9, { oneShareStartedAt: "2025-04" })[0]([])).toMatchObject({ payload: { one_share_started_on: "2025-04-01", one_share_started_legacy_text: null } });
    expect(() => dashboardInlineEdit(w, "1234", "test", 9, { oneShareStartedAt: "2025-13" })).toThrow();
    w.profiles[0].active = false;
    expect(() => dashboardInlineEdit(w, "1234", "test", 9, { crossType: "単発クロス" })).toThrow();
  });
  it("new inline profile commands use returned IDs and revisions", () => {
    const steps = dashboardInlineEdit(fixture(), "9999", "new", 9, { crossType: "単発クロス" });
    expect(steps).toHaveLength(3);
    const receipts = [{ schema_version: 1, request_id: "request", command_type: "create_profile", target_id: "created", revision: 1,
      event_id: "audit", replayed: false, before: null, after: {} }] as const;
    expect(steps[1](receipts)).toMatchObject({ payload: { profile_id: "created", entitlement_month: 9 } });
    expect(steps[2](receipts)).toMatchObject({ target: { id: "created" }, expected_revision: 1 });
  });
  it("merges one-share/profile edits and rejects moving a cycle to another rights month", () => {
    const w = fixture(), draft = buildMemoEditDraft(dashboardProjection(w, 2026).monthlyItems[1]);
    draft.memo = "changed"; draft.oneShareStartedAt = "2025-05";
    const commands = dashboardEditMemo(w, "p", 2026, 9, draft, date).map(step => step([]));
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ command_type: "update_profile", expected_revision: 3, payload: { memo: "changed", one_share_started_on: "2025-05-01" } });
    draft.acquired = true; draft.acquiredEntitlementMonthKey = "2026-08";
    expect(() => dashboardEditMemo(w, "p", 2026, 9, draft, date)).toThrow("2026-09");
    draft.acquiredEntitlementMonthKey = "2026-09";
    expect(dashboardEditMemo(w, "p", 2026, 9, draft, date).at(-1)!([])).toMatchObject({ command_type: "create_cycle", payload: { entitlement_year: 2026, entitlement_month: 9 } });
  });
});
