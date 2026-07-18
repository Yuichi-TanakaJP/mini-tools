import { describe, expect, it } from "vitest";
import { calculateSimpleYutaiEfficiency } from "../yutai-efficiency";

describe("calculateSimpleYutaiEfficiency", () => {
  it("必要株数に合わせた必要資金と簡易優待効率を計算する", () => {
    expect(calculateSimpleYutaiEfficiency({
      minimumInvestmentYen: 200_000,
      requiredShares: 500,
      benefitValueYen: 5_000,
    })).toEqual({
      requiredCapitalYen: 1_000_000,
      estimatedSharePriceYen: 2_000,
      efficiencyPercent: 0.5,
    });
  });

  it("100株条件なら最低投資金額をそのまま必要資金にする", () => {
    expect(calculateSimpleYutaiEfficiency({
      minimumInvestmentYen: 100_000,
      requiredShares: 100,
      benefitValueYen: 2_000,
    })?.efficiencyPercent).toBe(2);
  });

  it.each([
    { minimumInvestmentYen: null, requiredShares: 100, benefitValueYen: 1_000 },
    { minimumInvestmentYen: 100_000, requiredShares: 0, benefitValueYen: 1_000 },
    { minimumInvestmentYen: 100_000, requiredShares: 1.5, benefitValueYen: 1_000 },
    { minimumInvestmentYen: 100_000, requiredShares: 100, benefitValueYen: -1 },
  ])("入力が不足または不正なら null を返す: %o", (input) => {
    expect(calculateSimpleYutaiEfficiency(input)).toBeNull();
  });
});
