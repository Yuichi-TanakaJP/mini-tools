import { describe, expect, it } from "vitest";
import {
  NIKKO_CROSS_FEE_RATES,
  calculateNikkoCrossFee,
  resolveCrossSellSide,
} from "../yutai-cross-fee";

describe("resolveCrossSellSide", () => {
  it("一般信用売りが可能なら一般を優先する", () => {
    expect(resolveCrossSellSide({ generalShort: true, institutionalShort: true })).toBe("general");
    expect(resolveCrossSellSide({ generalShort: true, institutionalShort: false })).toBe("general");
  });

  it("一般が不可で制度が可なら制度を使う", () => {
    expect(resolveCrossSellSide({ generalShort: false, institutionalShort: true })).toBe("institutional");
  });

  it("どちらも不可なら null", () => {
    expect(resolveCrossSellSide({ generalShort: false, institutionalShort: false })).toBeNull();
  });
});

describe("calculateNikkoCrossFee", () => {
  const tradeAmountYen = 1_000_000;
  const holdingDays = 10;

  it("買方金利＋一般貸株料を日割りで合算する", () => {
    const fee = calculateNikkoCrossFee({ tradeAmountYen, holdingDays, sellSide: "general" });
    const expectedBuy =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalBuyAnnualRate * holdingDays) / 365;
    const expectedSell =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.generalLendingAnnualRate * holdingDays) / 365;
    expect(fee).not.toBeNull();
    expect(fee?.buyInterestYen).toBeCloseTo(expectedBuy, 6);
    expect(fee?.sellLendingYen).toBeCloseTo(expectedSell, 6);
    expect(fee?.totalYen).toBeCloseTo(expectedBuy + expectedSell, 6);
    expect(fee?.hasReverseChargeRisk).toBe(false);
  });

  it("制度信用売りは制度貸株料を使い逆日歩リスクありとなる", () => {
    const fee = calculateNikkoCrossFee({ tradeAmountYen, holdingDays, sellSide: "institutional" });
    const expectedSell =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalLendingAnnualRate * holdingDays) / 365;
    expect(fee?.sellLendingYen).toBeCloseTo(expectedSell, 6);
    expect(fee?.hasReverseChargeRisk).toBe(true);
  });

  it("約定金額・保有日数が不正なら null", () => {
    expect(calculateNikkoCrossFee({ tradeAmountYen: 0, holdingDays, sellSide: "general" })).toBeNull();
    expect(calculateNikkoCrossFee({ tradeAmountYen, holdingDays: 0, sellSide: "general" })).toBeNull();
  });
});
