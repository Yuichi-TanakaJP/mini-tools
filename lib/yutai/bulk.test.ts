import { describe, expect, it } from "vitest";
import { bulkMemoCommands, pastPreparationCycles } from "./bulk";
import { profileDraft, monthDraft } from "./memo";
import { cycleDraft } from "./cycles";
import type { Workspace } from "./contracts";
const row = { revision: 3, created_at: "2026-01-01", updated_at: "2026-01-01" };
const data = { profiles: [{ ...row, ...profileDraft(), id: "p", stock_code: "1234", active: true }],
  month_states: [{ ...row, ...monthDraft(), id: "m", profile_id: "p", entitlement_month: 9 }], cycles: [], rewards: [] } as unknown as Workspace;
describe("bulk memo commands", () => {
  it("creates only the selected entitlement year/month", () => {
    expect(bulkMemoCommands(data, ["p"], "prepared", "2027-09", "2026-09-01T00:00:00Z")).toMatchObject([
      { command_type: "create_cycle", expected_revision: 0, payload: { entitlement_year: 2027, entitlement_month: 9, status: "prepared" } }]);
  });
  it("rejects missing month, hidden targets, duplicate selection and destructive dependents", () => {
    expect(() => bulkMemoCommands(data, ["p"], "prepared", "", "2026-09-01")).toThrow();
    expect(() => bulkMemoCommands(data, ["p"], "prepared", "2026-08", "2026-09-01")).toThrow();
    expect(() => bulkMemoCommands(data, ["p", "p"], "prepared", "2026-09", "2026-09-01")).toThrow();
    expect(() => bulkMemoCommands(data, ["p"], "delete", "", "2026-09-01")).toThrow();
  });
  it("preserves old and future cycles and snapshots the expected revision", () => {
    const old = { ...row, ...cycleDraft(), id: "c", profile_id: "p", entitlement_year: 2026, entitlement_month: 9, status: "prepared" as const, prepared_at: "2026-08-01" };
    const future = { ...old, id: "future", entitlement_year: 2027 };
    const snapshot = { ...data, cycles: [old, future] };
    expect(bulkMemoCommands(snapshot, ["p"], "planned", "2026-09", "2026-09-01")).toEqual([
      { command_type: "update_cycle", target: { id: "c" }, expected_revision: 3, payload: { status: "planned", prepared_at: null } }]);
    expect(pastPreparationCycles(snapshot, "2026-10")).toEqual([old]);
    expect(snapshot.cycles[1]).toEqual(future);
    expect(() => bulkMemoCommands({ ...snapshot, cycles: [{ ...old, status: "received" }] }, ["p"], "planned", "2026-09", "2026-09-01")).toThrow();
  });
});
