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
  /** 計算に使った優待価値（円）。手数料との比較などに使う。 */
  benefitValueYen: number;
};

function isPositiveFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 株価と必要株数から購入資金を算出する。優待価値は必要としない。 */
export function calculateYutaiPurchaseCapital(
  input: Omit<SimpleYutaiEfficiencyInput, "benefitValueYen">,
): Omit<SimpleYutaiEfficiencyResult, "efficiencyPercent" | "benefitValueYen"> | null {
  const { minimumInvestmentYen, sharePriceYen, requiredShares } = input;
  if (!isPositiveFiniteNumber(requiredShares) || !Number.isSafeInteger(requiredShares)) return null;
  const marketPriceAvailable = isPositiveFiniteNumber(sharePriceYen);
  if (!marketPriceAvailable && !isPositiveFiniteNumber(minimumInvestmentYen)) return null;
  const resolvedSharePriceYen = marketPriceAvailable
    ? sharePriceYen
    : minimumInvestmentYen / STANDARD_TRADING_UNIT_SHARES;
  const requiredCapitalYen = resolvedSharePriceYen * requiredShares;
  if (!Number.isFinite(requiredCapitalYen) || requiredCapitalYen > Number.MAX_SAFE_INTEGER) return null;
  return {
    requiredCapitalYen,
    sharePriceYen: resolvedSharePriceYen,
    sharePriceSource: marketPriceAvailable ? "market" : "estimated",
  };
}

/** 必要資金に対する優待価値の割合。手数料・配当・株価変動は含めない。 */
export function calculateSimpleYutaiEfficiency(
  input: SimpleYutaiEfficiencyInput,
): SimpleYutaiEfficiencyResult | null {
  const capital = calculateYutaiPurchaseCapital(input);
  const { benefitValueYen } = input;
  if (!capital || !isPositiveFiniteNumber(benefitValueYen) || !Number.isInteger(benefitValueYen)) return null;
  return {
    ...capital,
    efficiencyPercent: (benefitValueYen / capital.requiredCapitalYen) * 100,
    benefitValueYen,
  };
}
