import { describe, expect, it } from "vitest";
import type { Reward } from "./contracts";
import { localToday, rewardList, rewardPeriodCounts, type RewardPeriod } from "./reward-list";
const base: Reward = { id: "a", title: "A", company: "A", expires_on: "2026-12-31", track_mode: "count", initial_value: 2,
  remaining_value: 1, unit_yen: null, memo: "メモ", link: "https://example.com/benefit", archived_at: null, profile_id: null, cycle_id: null,
  revision: 1, created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" };
const options = { query: "", month: "", archives: false, completed: true, period: "all" as RewardPeriod, sort: "expiryAsc" as const };
describe("reward list projection", () => {
  it("keeps expiry day valid and handles year/month boundaries and undated rows", () => {
    const rows = [base, { ...base, id: "b", expires_on: "2027-01-01" }, { ...base, id: "c", expires_on: "2026-12-30" }, { ...base, id: "d", expires_on: null }];
    const ids = (period: RewardPeriod) => rewardList(rows, { ...options, period }, "2026-12-31").map(r => r.id);
    expect(ids("thisMonth")).toEqual(["c", "a"]); expect(ids("later")).toEqual(["b"]);
    expect(ids("overdue")).toEqual(["c"]); expect(ids("noExpiry")).toEqual(["d"]);
  });
  it("counts active positive balances independently of used/archived display", () => {
    const rows = [base, { ...base, id: "zero", remaining_value: 0 }, { ...base, id: "archive", archived_at: base.created_at }];
    expect(rewardPeriodCounts(rows, "2026-12-31")).toEqual({ all: 1, thisMonth: 1, later: 0, overdue: 0, noExpiry: 0 });
    expect(rewardList(rows, options, "2026-12-31")).toHaveLength(2);
    expect(rewardList(rows, { ...options, completed: false }, "2026-12-31")).toHaveLength(1);
    expect(rewardList(rows, { ...options, archives: true }, "2026-12-31")).toHaveLength(3);
  });
  it("searches trimmed title/company/memo/URL and combines explicit month", () => {
    expect(rewardList([base], { ...options, query: " BENEFIT ", month: "2026-12" }, "2026-12-31")).toHaveLength(1);
    expect(rewardList([base], { ...options, query: "absent" }, "2026-12-31")).toHaveLength(0);
    expect(rewardList([base], { ...options, month: "2027-01" }, "2026-12-31")).toHaveLength(0);
  });
  it("sorts without changing source rows and retains null/zero/decimals", () => {
    const rows = [Object.freeze({ ...base, id: "z", company: "Z", expires_on: null }), Object.freeze({ ...base, id: "b", company: "B", unit_yen: 0 }),
      Object.freeze({ ...base, id: "c", company: "C", track_mode: "amount" as const, remaining_value: 0.25, created_at: "2026-09-10T09:01:00+09:00" })];
    const original = JSON.stringify(rows); Object.freeze(rows);
    expect(rewardList(rows, options, "2026-12-31").map(r => r.id)).toEqual(["b", "c", "z"]);
    expect(rewardList(rows, { ...options, sort: "companyAsc" }, "2026-12-31").map(r => r.company)).toEqual(["B", "C", "Z"]);
    expect(rewardList(rows, { ...options, sort: "createdDesc" }, "2026-12-31")[0].id).toBe("c");
    expect(JSON.stringify(rows)).toBe(original);
  });
  it("formats the local calendar day without UTC conversion", () => {
    expect(localToday(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
    expect(rewardList([], options, "2026-01-01")).toEqual([]);
    expect(rewardPeriodCounts([], "2026-01-01").all).toBe(0);
  });
});
