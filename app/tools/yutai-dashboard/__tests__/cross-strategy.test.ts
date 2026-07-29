import { describe, expect, it } from "vitest";
import { getRowCrossType, type CrossStrategyRowInput } from "../cross-strategy";
import { type YutaiLaunchDisplayRecord } from "../launch-display";

function recordWithHoldingMonths(monthsPerTier: number[]): YutaiLaunchDisplayRecord {
  return {
    month: "2026-09",
    code: "1234",
    companyName: "テスト",
    displayStatus: "conditions_available",
    calculationStatus: "auto_calculable",
    requiresUserValuation: false,
    hasLongTermBenefit: monthsPerTier.some((month) => month > 0),
    requiresLongTermHolding: monthsPerTier.length > 0 && monthsPerTier.every((month) => month > 0),
    longTermRequiredHoldingMonths: [...new Set(monthsPerTier.filter((month) => month > 0))].sort((a, b) => a - b),
    longTermBenefitTiers: [],
    normalizedStatus: null,
    normalizedAsOfDate: null,
    notes: null,
    programs: [
      {
        programId: "p",
        label: "優待",
        rightsMonths: [9],
        notes: null,
        tiers: monthsPerTier.map((m, i) => ({
          minimumShares: 100 * (i + 1),
          maximumShares: null,
          requiredHoldingMonths: m,
          groups: [],
        })),
      },
    ],
  };
}

const candidateRow: CrossStrategyRowInput = {
  code: "1234",
  memo: null,
  candidate: { month: 9 },
};

describe("getRowCrossType", () => {
  it("メモがあれば手動値をそのまま返す（derived=false）", () => {
    const byKey = new Map([["1234:9", recordWithHoldingMonths([0, 0])]]);
    const row: CrossStrategyRowInput = { ...candidateRow, memo: { crossType: "連続クロス" } };
    // 公式が長期特典なしでも、手動値が優先される
    expect(getRowCrossType(row, byKey)).toEqual({ value: "連続クロス", derived: false });
  });

  it("メモ無し×公式レコードあり×長期特典なし: 長期優遇なしを導出（derived=true）", () => {
    const byKey = new Map([["1234:9", recordWithHoldingMonths([0, 0])]]);
    expect(getRowCrossType(candidateRow, byKey)).toEqual({ value: "長期優遇なし", derived: true });
  });

  it("メモ無し×公式レコードあり×長期特典あり: 未トリアージなので未設定（null）", () => {
    const byKey = new Map([["1234:9", recordWithHoldingMonths([0, 12])]]);
    expect(getRowCrossType(candidateRow, byKey)).toBeNull();
  });

  it("メモ無し×公式レコード無し（不明）: 断定せず未設定（null）", () => {
    // getLongTermFlags(undefined) が benefit:false でも、レコード不在は導出しない
    expect(getRowCrossType(candidateRow, new Map())).toBeNull();
  });

  it("メモ無し×候補行でない（candidate=null）: 未設定（null）", () => {
    const byKey = new Map([["1234:9", recordWithHoldingMonths([0, 0])]]);
    const row: CrossStrategyRowInput = { ...candidateRow, candidate: null };
    expect(getRowCrossType(row, byKey)).toBeNull();
  });

  it("全月ビュー相当（空Map）: 公式判定が働かず未設定（null）", () => {
    expect(getRowCrossType(candidateRow, new Map())).toBeNull();
  });
});
