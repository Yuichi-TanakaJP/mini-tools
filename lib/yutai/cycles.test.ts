import { describe, expect, it } from "vitest";
import type { Cycle, Workspace } from "./contracts";
import { cycleDraft, deleteCycle, localTimestamp, saveCycle, timestampValue } from "./cycles";
const original: Cycle = { ...cycleDraft(), id: "c", profile_id: "p", entitlement_year: 2026, entitlement_month: 9,
  status: "prepared", prepared_at: "2026-08-15T12:34:56.123456+09:00", quantity: 100, note: "旧メモ保持",
  revision: 7, created_at: "2026-08-15", updated_at: "2026-08-15" };
const snapshot = { profiles: [{ id: "p" }], cycles: [original], rewards: [] } as unknown as Workspace;
describe("cycle commands", () => {
  it("does not guess a year, month, quantity or timestamp", () => expect(cycleDraft()).toMatchObject({ entitlement_year: 0, entitlement_month: 0, quantity: null, prepared_at: null }));
  it("creates only the explicit target period", () => expect(saveCycle(snapshot, "p", null, { ...cycleDraft(), entitlement_year: 2027, entitlement_month: 9 })).toMatchObject({ command_type: "create_cycle", expected_revision: 0, payload: { profile_id: "p", entitlement_year: 2027, entitlement_month: 9, quantity: null } }));
  it("updates changed fields with captured revision, preserving all other data", () => {
    expect(saveCycle(snapshot, "p", original, { ...cycleDraft(original), quantity: 200 })).toEqual({ command_type: "update_cycle", target: { id: "c" }, expected_revision: 7, payload: { quantity: 200 } });
    expect(snapshot.cycles[0].quantity).toBe(100);
  });
  it("does not save unchanged records", () => expect(saveCycle(snapshot, "p", original, cycleDraft(original))).toBeNull());
  it("does not clear historical dates on status changes", () => expect(saveCycle(snapshot, "p", original, { ...cycleDraft(original), status: "settled" })).toMatchObject({ payload: { status: "settled" } }));
  it("rejects a duplicate period", () => expect(() => saveCycle(snapshot, "p", null, cycleDraft(original))).toThrow("同じ銘柄"));
  it.each([0, 10000, 2026.5])("rejects invalid year %s", year => expect(() => saveCycle(snapshot, "p", original, { ...cycleDraft(original), entitlement_year: year })).toThrow());
  it.each([0, 13, 1.5])("rejects invalid month %s", month => expect(() => saveCycle(snapshot, "p", original, { ...cycleDraft(original), entitlement_month: month })).toThrow());
  it.each([0, -1, 0.5, Infinity, 2147483648])("rejects invalid quantity %s", quantity => expect(() => saveCycle(snapshot, "p", original, { ...cycleDraft(original), quantity })).toThrow());
  it("requires prepared timestamp", () => expect(() => saveCycle(snapshot, "p", original, { ...cycleDraft(original), prepared_at: null })).toThrow("仕込み日時"));
  it("rejects invalid timestamps", () => expect(() => saveCycle(snapshot, "p", original, { ...cycleDraft(original), received_at: "invalid" })).toThrow());
  it("rejects wrong profile", () => expect(() => saveCycle(snapshot, "other", original, cycleDraft(original))).toThrow());
  it("retains exact untouched timestamp precision and offset", () => expect(timestampValue(localTimestamp(original.prepared_at), original.prepared_at)).toBe(original.prepared_at));
  it("accepts explicit date clearing and converts changed local time", () => {
    expect(timestampValue("", original.prepared_at)).toBeNull();
    expect(timestampValue("2026-09-10T12:30", null)).toBe(new Date("2026-09-10T12:30").toISOString());
  });
  it("blocks deletion of a cycle linked to any reward including archived ones", () => expect(() => deleteCycle({ ...snapshot, rewards: [{ cycle_id: "c", archived_at: "2026-09-01" }] } as Workspace, original, "訂正")).toThrow("紐付いた"));
  it("requires a deletion reason", () => expect(() => deleteCycle(snapshot, original, " ")).toThrow("理由"));
  it("deletes only selected history with its revision and reason", () => expect(deleteCycle(snapshot, original, " 誤登録 ")).toEqual({ command_type: "delete_cycle", target: { id: "c" }, expected_revision: 7, payload: {}, note: "誤登録" }));
});
