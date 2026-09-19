import { describe, expect, it } from "vitest";
import type { BenefitItemV2 } from "@/app/tools/yutai-expiry/benefits/store";
import { selectUpcomingBenefitExpiries, selectUpcomingRewardExpiries } from "./yutai-expiry";
import type { Reward } from "@/lib/yutai/contracts";

function benefit(
  expiresOn: string | null,
  overrides: Partial<BenefitItemV2> = {},
): BenefitItemV2 {
  return {
    id: overrides.id ?? expiresOn ?? "no-expiry",
    title: "テスト優待",
    company: "テスト社",
    expiresOn,
    isUsed: false,
    trackMode: "count",
    unitYen: 500,
    initial: 1,
    remaining: 1,
    history: [],
    archivedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectUpcomingBenefitExpiries", () => {
  const reward: Reward = { id: "db", title: "DB優待", company: "DB社", expires_on: "2026-12-31",
    track_mode: "amount", initial_value: 1, remaining_value: 0.25, unit_yen: null, memo: "", link: null,
    profile_id: null, cycle_id: null, archived_at: null, revision: 1, created_at: "", updated_at: "" };
  it("DBの小数残高を保持し年跨ぎの7日境界を判定する", () => {
    const rows = [reward, { ...reward, id: "seven", expires_on: "2027-01-08" }, { ...reward, id: "eight", expires_on: "2027-01-09" }];
    expect(selectUpcomingRewardExpiries(rows, "2027-01-01").map(x => x.item.id)).toEqual(["seven"]);
    expect(selectUpcomingRewardExpiries(rows, "2026-12-31")[0].item.id).toBe("db");
    expect(reward.remaining_value).toBe(0.25);
  });
  it("DBの使用済み・アーカイブ・不正日付・未設定日付を除外する", () => {
    expect(selectUpcomingRewardExpiries([
      { ...reward, remaining_value: 0 }, { ...reward, archived_at: "2026-12-30" },
      { ...reward, expires_on: null }, { ...reward, expires_on: "2026-02-30" },
    ], "2026-12-31")).toEqual([]);
    expect(selectUpcomingRewardExpiries([reward], "invalid")).toEqual([]);
  });
  it("今日から7日以内を期限順で返す", () => {
    const result = selectUpcomingBenefitExpiries(
      [benefit("2026-07-05"), benefit("2026-06-28"), benefit("2026-07-06")],
      "2026-06-28",
    );

    expect(result.map(({ item, daysUntilExpiry }) => [item.expiresOn, daysUntilExpiry])).toEqual([
      ["2026-06-28", 0],
      ["2026-07-05", 7],
    ]);
  });

  it("期限切れ・使用済み・アーカイブ済み・期限なしを除外する", () => {
    const result = selectUpcomingBenefitExpiries(
      [
        benefit("2026-06-27"),
        benefit("2026-06-30", { isUsed: true }),
        benefit("2026-07-01", { archivedAt: "2026-06-20T00:00:00.000Z" }),
        benefit(null),
      ],
      "2026-06-28",
    );

    expect(result).toEqual([]);
  });
});
