import { describe, expect, it } from "vitest";
import { memoList, type MemoListOptions } from "./memo-list";
import { profileDraft, monthDraft } from "./memo";
import type { Profile, MonthState } from "./contracts";
const row = { revision: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const p: Profile = { ...profileDraft(), ...row, id: "a", stock_code: "130A", display_name: "A", active: true, portfolio_instrument_id: null, one_share_started_legacy_text: null, default_preparation_months_before: 3 };
const m: MonthState = { ...monthDraft(), ...row, id: "m", profile_id: "a", entitlement_month: 1, preparation_months_before: 1 };
const data = { profiles: [p, { ...p, id: "b", stock_code: "2345", display_name: "B", active: false }],
  month_states: [m], tags: [{ ...row, id: "t", name: "鉄板" }], profile_tags: [{ profile_id: "a", tag_id: "t", created_at: row.created_at }] };
const options: MemoListOptions = { query: "", inactive: false, month: null, axis: "entitlement", tag: "", sort: "created_at", descending: true };
describe("DB memo list", () => {
  it("uses monthly leads across December, not the profile default", () => {
    expect(memoList(data, { ...options, axis: "preparation", month: 12 })).toHaveLength(1);
    expect(memoList(data, { ...options, axis: "preparation", month: 10 })).toHaveLength(0);
    expect(memoList(data, { ...options, month: 1 })).toHaveLength(1);
    expect(memoList(data, { ...options, month: 12 })).toHaveLength(0);
  });
  it("distinguishes missing from zero and handles 11 months lead", () => {
    const project = (lead: number | null, month: number) => memoList({ ...data, month_states: [{ ...m, preparation_months_before: lead }] }, { ...options, axis: "preparation", month });
    expect(project(null, 1)).toHaveLength(0); expect(project(0, 1)).toHaveLength(1); expect(project(11, 2)).toHaveLength(1);
  });
  it("combines normalized search and tag/inactive filters without duplicating profiles", () => {
    expect(memoList(data, { ...options, query: " １３０ａ ", tag: "t" })).toHaveLength(1);
    expect(memoList(data, { ...options, query: "鉄板" })).toHaveLength(1);
    expect(memoList(data, { ...options, tag: "deleted" })).toHaveLength(0);
    expect(memoList(data, { ...options, inactive: true })).toHaveLength(2);
    expect(memoList({ ...data, month_states: [m, { ...m, id: "m2", entitlement_month: 2 }] }, options)).toHaveLength(1);
  });
  it("sorts both directions without mutating input and handles empty data", () => {
    const before = JSON.stringify(data); Object.freeze(data.profiles); data.profiles.forEach(Object.freeze);
    expect(memoList(data, { ...options, inactive: true, sort: "display_name" }).map(p => p.id)).toEqual(["b", "a"]);
    expect(memoList(data, { ...options, inactive: true, sort: "stock_code", descending: false }).map(p => p.id)).toEqual(["a", "b"]);
    expect(JSON.stringify(data)).toBe(before);
    expect(memoList({ profiles: [], month_states: [], tags: [], profile_tags: [] }, options)).toEqual([]);
  });
});
