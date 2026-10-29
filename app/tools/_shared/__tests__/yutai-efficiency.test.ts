import { describe, expect, it } from "vitest";
import { calculateSimpleYutaiEfficiency, calculateYutaiPurchaseCapital } from "../yutai-efficiency";

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
      benefitValueYen: 5_000,
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
      benefitValueYen: 5_000,
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


describe("calculateYutaiPurchaseCapital", () => {
  it.each([100, 300, 500])("優待価値なしでも%s株の購入額を算出する", (shares) => {
    expect(calculateYutaiPurchaseCapital({sharePriceYen: 2139, minimumInvestmentYen: 200000, requiredShares: shares}))
      .toEqual({requiredCapitalYen: 2139 * shares, sharePriceYen: 2139, sharePriceSource: "market"});
    expect(calculateSimpleYutaiEfficiency({sharePriceYen: 2139, minimumInvestmentYen: 200000, requiredShares: shares, benefitValueYen: null})).toBeNull();
  });
  it("未取得株価は100株分の最低投資金額を使った概算と明示する", () => {
    expect(calculateYutaiPurchaseCapital({minimumInvestmentYen: 200000, requiredShares: 300}))
      .toEqual({requiredCapitalYen: 600000, sharePriceYen: 2000, sharePriceSource: "estimated"});
  });
  it.each([null, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])("不正な株数%sは金額を捏造しない", (shares) => {
    expect(calculateYutaiPurchaseCapital({sharePriceYen: 2000, minimumInvestmentYen: null, requiredShares: shares})).toBeNull();
  });
  it("価格不明・積のオーバーフローは表示しない", () => {
    expect(calculateYutaiPurchaseCapital({requiredShares: 100, minimumInvestmentYen: null})).toBeNull();
    expect(calculateYutaiPurchaseCapital({requiredShares: 100, minimumInvestmentYen: null, sharePriceYen: Number.MAX_VALUE})).toBeNull();
  });
});
