import { describe, expect, it } from "vitest";
import type { BenefitItemV2 } from "@/app/tools/yutai-expiry/benefits/store";
import { selectUpcomingBenefitExpiries } from "./yutai-expiry";

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
