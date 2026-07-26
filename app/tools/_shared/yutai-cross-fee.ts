/**
 * 日興（SMBC日興証券）でのクロス取引（つなぎ売り）にかかる手数料の概算。
 *
 * 前提:
 * - 買い: 制度信用買い → 現引き（信用委託手数料・現引き手数料ともに 0 円）。
 *   現引きすると建玉は現物になり以降は金利がかからないため、買方金利は「現引きまでの
 *   数日（既定=2営業日相当）」分だけ計上する。保有全期間には課金しない。
 * - 売り: 一般信用売建の「対象銘柄」なら一般で計算する（在庫0・取引停止など今すぐ売れない
 *   状態でも一般前提）。一般の対象外の銘柄に限り、奥の手として制度信用売りで計算する。
 *   売り建ては現渡しまで継続するため、貸株料は保有期間（今日→権利付最終日）分を計上する。
 *   制度信用売り時は逆日歩が別途発生し得る（予測不可のため非計上）。
 *
 * 率は変動するため、改定時はこの定数のみ更新すること。
 * 出所: SMBC日興証券 公式（2026-07-21 約定分〜の金利改定、2026-03-30 約定分〜の貸株料を反映）。
 */
export const NIKKO_CROSS_FEE_RATES = {
  /** 制度信用 買方金利（年率） */
  institutionalBuyAnnualRate: 0.0254,
  /** 制度信用 貸株料（年率） */
  institutionalLendingAnnualRate: 0.0115,
  /** 一般信用 貸株料（年率） */
  generalLendingAnnualRate: 0.019,
} as const;

/** 制度信用買い→現引きまでの標準的な受渡日数（営業日）。買方金利の計上日数に使う。 */
export const BUY_TO_GENBIKI_BUSINESS_DAYS = 2;

export type CrossSellSide = "general" | "institutional";

export type NikkoCrossFee = {
  /** 実際に使う売り建て区分 */
  sellSide: CrossSellSide;
  /** 貸株料の対象日数（暦日、今日→権利付最終日） */
  sellHoldingDays: number;
  /** 買方金利の対象日数（暦日、現引きまで） */
  buyInterestDays: number;
  /** 約定金額（株価 × 必要株数） */
  tradeAmountYen: number;
  /** 買い側（制度信用買い→現引き）の買方金利コスト */
  buyInterestYen: number;
  /** 売り側の貸株料コスト */
  sellLendingYen: number;
  /** 合計手数料 */
  totalYen: number;
  /** 制度信用売りを使うため逆日歩が別途発生し得る */
  hasReverseChargeRisk: boolean;
};

/**
 * 使う売り建て区分を決める。
 * 一般信用売建の「対象銘柄」なら在庫状況によらず一般（generalTarget=true → "general"）。
 * 一般の対象外に限り、奥の手として制度信用売り。どちらも不可なら null。
 */
export function resolveCrossSellSide(availability: {
  generalTarget: boolean;
  institutionalShort: boolean;
}): CrossSellSide | null {
  if (availability.generalTarget) return "general";
  if (availability.institutionalShort) return "institutional";
  return null;
}

export function calculateNikkoCrossFee(params: {
  tradeAmountYen: number;
  /** 貸株料の対象日数（今日→権利付最終日の暦日） */
  sellHoldingDays: number;
  /** 買方金利の対象日数（現引きまでの暦日） */
  buyInterestDays: number;
  sellSide: CrossSellSide;
}): NikkoCrossFee | null {
  const { tradeAmountYen, sellHoldingDays, buyInterestDays, sellSide } = params;
  if (!(tradeAmountYen > 0) || !Number.isFinite(tradeAmountYen)) return null;
  if (!(sellHoldingDays > 0) || !Number.isFinite(sellHoldingDays)) return null;
  if (!(buyInterestDays >= 0) || !Number.isFinite(buyInterestDays)) return null;

  const buyInterestYen =
    (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalBuyAnnualRate * buyInterestDays) / 365;
  const lendingRate =
    sellSide === "general"
      ? NIKKO_CROSS_FEE_RATES.generalLendingAnnualRate
      : NIKKO_CROSS_FEE_RATES.institutionalLendingAnnualRate;
  const sellLendingYen = (tradeAmountYen * lendingRate * sellHoldingDays) / 365;

  return {
    sellSide,
    sellHoldingDays,
    buyInterestDays,
    tradeAmountYen,
    buyInterestYen,
    sellLendingYen,
    totalYen: buyInterestYen + sellLendingYen,
    hasReverseChargeRisk: sellSide === "institutional",
  };
}
