import { describe, expect, it } from "vitest";
import {
  NIKKO_CROSS_FEE_RATES,
  calculateNikkoCrossFee,
  resolveCrossSellSide,
} from "../yutai-cross-fee";

describe("resolveCrossSellSide", () => {
  it("一般対象銘柄なら在庫状況によらず一般を優先する（制度は奥の手）", () => {
    expect(resolveCrossSellSide({ generalTarget: true, institutionalShort: true })).toBe("general");
    expect(resolveCrossSellSide({ generalTarget: true, institutionalShort: false })).toBe("general");
  });

  it("一般対象外で制度が可なら奥の手として制度を使う", () => {
    expect(resolveCrossSellSide({ generalTarget: false, institutionalShort: true })).toBe("institutional");
  });

  it("どちらも不可なら null", () => {
    expect(resolveCrossSellSide({ generalTarget: false, institutionalShort: false })).toBeNull();
  });
});

describe("calculateNikkoCrossFee", () => {
  const tradeAmountYen = 1_000_000;
  const sellHoldingDays = 32;
  const buyInterestDays = 2;

  it("買方金利は現引きまでの日数、貸株料は保有期間の日数で日割りする", () => {
    const fee = calculateNikkoCrossFee({ tradeAmountYen, sellHoldingDays, buyInterestDays, sellSide: "general" });
    const expectedBuy =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalBuyAnnualRate * buyInterestDays) / 365;
    const expectedSell =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.generalLendingAnnualRate * sellHoldingDays) / 365;
    expect(fee).not.toBeNull();
    expect(fee?.buyInterestYen).toBeCloseTo(expectedBuy, 6);
    expect(fee?.sellLendingYen).toBeCloseTo(expectedSell, 6);
    expect(fee?.totalYen).toBeCloseTo(expectedBuy + expectedSell, 6);
    expect(fee?.hasReverseChargeRisk).toBe(false);
  });

  it("吉野家(100株, 約361,200円, 一般売り)の概算が参照値690円に近い", () => {
    // 株価 3,612円 × 100株、貸株料 33日（今日→権利落ち相当）、買方金利 3日（現引きまで）
    const fee = calculateNikkoCrossFee({
      tradeAmountYen: 361_200,
      sellHoldingDays: 33,
      buyInterestDays: 3,
      sellSide: "general",
    });
    expect(fee?.totalYen).toBeGreaterThan(650);
    expect(fee?.totalYen).toBeLessThan(730);
  });

  it("制度信用売りは制度貸株料を使い逆日歩リスクありとなる", () => {
    const fee = calculateNikkoCrossFee({ tradeAmountYen, sellHoldingDays, buyInterestDays, sellSide: "institutional" });
    const expectedSell =
      (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalLendingAnnualRate * sellHoldingDays) / 365;
    expect(fee?.sellLendingYen).toBeCloseTo(expectedSell, 6);
    expect(fee?.hasReverseChargeRisk).toBe(true);
  });

  it("買方金利0日（現引き即日）でも貸株料だけで計算できる", () => {
    const fee = calculateNikkoCrossFee({ tradeAmountYen, sellHoldingDays, buyInterestDays: 0, sellSide: "general" });
    expect(fee?.buyInterestYen).toBe(0);
    expect(fee?.sellLendingYen).toBeGreaterThan(0);
  });

  it("約定金額・保有日数が不正なら null", () => {
    expect(calculateNikkoCrossFee({ tradeAmountYen: 0, sellHoldingDays, buyInterestDays, sellSide: "general" })).toBeNull();
    expect(calculateNikkoCrossFee({ tradeAmountYen, sellHoldingDays: 0, buyInterestDays, sellSide: "general" })).toBeNull();
  });
});
