/**
 * 日興（SMBC日興証券）でのクロス取引（つなぎ売り）にかかる手数料の概算。
 *
 * 前提:
 * - 買い: 制度信用買い → 現引き（信用委託手数料・現引き手数料ともに 0 円）
 *   コストは制度信用の買方金利のみ。
 * - 売り: 一般信用売りが可能ならそれを使い（逆日歩なし）、無ければ制度信用売り。
 *   コストは各区分の貸株料。制度信用売り時は逆日歩が別途発生し得る（予測不可のため非計上）。
 * - 保有日数: 今日 → 権利付最終日（月末の 2 営業日前）の暦日数。
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

export type CrossSellSide = "general" | "institutional";

export type NikkoCrossFee = {
  /** 実際に使う売り建て区分 */
  sellSide: CrossSellSide;
  /** 保有日数（暦日） */
  holdingDays: number;
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
 * 日興の制度信用可否から、使う売り建て区分を決める。
 * 一般信用売りを優先し、無ければ制度信用売り。どちらも不可なら null。
 */
export function resolveCrossSellSide(availability: {
  generalShort: boolean;
  institutionalShort: boolean;
}): CrossSellSide | null {
  if (availability.generalShort) return "general";
  if (availability.institutionalShort) return "institutional";
  return null;
}

export function calculateNikkoCrossFee(params: {
  tradeAmountYen: number;
  holdingDays: number;
  sellSide: CrossSellSide;
}): NikkoCrossFee | null {
  const { tradeAmountYen, holdingDays, sellSide } = params;
  if (!(tradeAmountYen > 0) || !Number.isFinite(tradeAmountYen)) return null;
  if (!(holdingDays > 0) || !Number.isFinite(holdingDays)) return null;

  const buyInterestYen =
    (tradeAmountYen * NIKKO_CROSS_FEE_RATES.institutionalBuyAnnualRate * holdingDays) / 365;
  const lendingRate =
    sellSide === "general"
      ? NIKKO_CROSS_FEE_RATES.generalLendingAnnualRate
      : NIKKO_CROSS_FEE_RATES.institutionalLendingAnnualRate;
  const sellLendingYen = (tradeAmountYen * lendingRate * holdingDays) / 365;

  return {
    sellSide,
    holdingDays,
    tradeAmountYen,
    buyInterestYen,
    sellLendingYen,
    totalYen: buyInterestYen + sellLendingYen,
    hasReverseChargeRisk: sellSide === "institutional",
  };
}
