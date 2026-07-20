const STANDARD_TRADING_UNIT_SHARES = 100;

export type SimpleYutaiEfficiencyInput = {
  minimumInvestmentYen: number | null | undefined;
  sharePriceYen?: number | null;
  requiredShares: number | null | undefined;
  benefitValueYen: number | null | undefined;
};

export type SimpleYutaiEfficiencyResult = {
  requiredCapitalYen: number;
  sharePriceYen: number;
  sharePriceSource: "market" | "estimated";
  efficiencyPercent: number;
};

function isPositiveFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * 実株価を優先し、未取得時だけみんかぶの最低投資金額（通常100株分）から
 * 概算株価を出して、必要株数に合わせた必要資金と簡易優待効率を計算する。
 * 手数料・配当・株価変動は含めない。
 */
export function calculateSimpleYutaiEfficiency(
  input: SimpleYutaiEfficiencyInput,
): SimpleYutaiEfficiencyResult | null {
  const { minimumInvestmentYen, sharePriceYen, requiredShares, benefitValueYen } = input;
  if (
    !isPositiveFiniteNumber(requiredShares) ||
    !Number.isInteger(requiredShares) ||
    !isPositiveFiniteNumber(benefitValueYen) ||
    !Number.isInteger(benefitValueYen)
  ) {
    return null;
  }

  const marketPriceAvailable = isPositiveFiniteNumber(sharePriceYen);
  if (!marketPriceAvailable && !isPositiveFiniteNumber(minimumInvestmentYen)) return null;
  const resolvedSharePriceYen = marketPriceAvailable
    ? sharePriceYen
    : minimumInvestmentYen / STANDARD_TRADING_UNIT_SHARES;
  const requiredCapitalYen = resolvedSharePriceYen * requiredShares;

  return {
    requiredCapitalYen,
    sharePriceYen: resolvedSharePriceYen,
    sharePriceSource: marketPriceAvailable ? "market" : "estimated",
    efficiencyPercent: (benefitValueYen / requiredCapitalYen) * 100,
  };
}
