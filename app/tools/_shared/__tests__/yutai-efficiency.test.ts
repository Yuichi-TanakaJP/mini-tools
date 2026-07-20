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
      sharePriceYen: 2_000,
      sharePriceSource: "estimated",
      efficiencyPercent: 0.5,
    });
  });

  it("実株価があれば最低投資金額より優先する", () => {
    expect(calculateSimpleYutaiEfficiency({
      minimumInvestmentYen: 200_000,
      sharePriceYen: 2_100,
      requiredShares: 500,
      benefitValueYen: 5_000,
    })).toEqual({
      requiredCapitalYen: 1_050_000,
      sharePriceYen: 2_100,
      sharePriceSource: "market",
      efficiencyPercent: 5_000 / 1_050_000 * 100,
    });
  });

  it("最低投資金額がなくても実株価があれば計算できる", () => {
    expect(calculateSimpleYutaiEfficiency({
      minimumInvestmentYen: null,
      sharePriceYen: 1_500,
      requiredShares: 100,
      benefitValueYen: 3_000,
    })?.efficiencyPercent).toBe(2);
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
