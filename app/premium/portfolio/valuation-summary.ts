import type { PortfolioExternalAssets, PortfolioPosition } from "./types";

export type PortfolioValuationSummary = {
  totalMarketValue: number | null;
  officialMarketValue: number | null;
  externalMarketValue: number | null;
  officialPositionCount: number;
  externalPositionCount: number;
  missingMarketValueCount: number;
};

function sumKnownAmounts(values: Array<number | null>) {
  const knownValues = values.filter((value): value is number => value !== null);
  return knownValues.length > 0 ? knownValues.reduce((sum, value) => sum + value, 0) : null;
}

export function summarizePortfolioValuation(
  positions: PortfolioPosition[],
  externalAssets: PortfolioExternalAssets,
): PortfolioValuationSummary {
  const officialMarketValue = sumKnownAmounts(positions.map((position) => position.marketValue));
  const externalMarketValue = externalAssets.totalMarketValue;

  return {
    totalMarketValue: sumKnownAmounts([officialMarketValue, externalMarketValue]),
    officialMarketValue,
    externalMarketValue,
    officialPositionCount: positions.length,
    externalPositionCount: externalAssets.positions.length,
    missingMarketValueCount:
      positions.filter((position) => position.marketValue === null).length
      + externalAssets.missingMarketValueCount,
  };
}
