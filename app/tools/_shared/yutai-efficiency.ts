const STANDARD_TRADING_UNIT_SHARES = 100;

export type SimpleYutaiEfficiencyInput = {
  minimumInvestmentYen: number | null | undefined;
  requiredShares: number | null | undefined;
  benefitValueYen: number | null | undefined;
};

export type SimpleYutaiEfficiencyResult = {
  requiredCapitalYen: number;
  estimatedSharePriceYen: number;
  efficiencyPercent: number;
};

function isPositiveFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * みんかぶの最低投資金額（通常100株分）から概算株価を出し、
 * 入力された必要株数に合わせた必要資金と簡易優待効率を計算する。
 * 手数料・配当・株価変動は含めない。
 */
export function calculateSimpleYutaiEfficiency(
  input: SimpleYutaiEfficiencyInput,
): SimpleYutaiEfficiencyResult | null {
  const { minimumInvestmentYen, requiredShares, benefitValueYen } = input;
  if (
    !isPositiveFiniteNumber(minimumInvestmentYen) ||
    !isPositiveFiniteNumber(requiredShares) ||
    !Number.isInteger(requiredShares) ||
    !isPositiveFiniteNumber(benefitValueYen) ||
    !Number.isInteger(benefitValueYen)
  ) {
    return null;
  }

  const estimatedSharePriceYen = minimumInvestmentYen / STANDARD_TRADING_UNIT_SHARES;
  const requiredCapitalYen = estimatedSharePriceYen * requiredShares;

  return {
    requiredCapitalYen,
    estimatedSharePriceYen,
    efficiencyPercent: (benefitValueYen / requiredCapitalYen) * 100,
  };
}
