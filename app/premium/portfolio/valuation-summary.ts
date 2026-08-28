import type { PortfolioExternalAssets, PortfolioPosition } from "./types";

export type PortfolioValuationSummary = {
  totalMarketValue: number | null;
  officialMarketValue: number | null;
  externalMarketValue: number | null;
  officialSharePct: number | null;
  externalSharePct: number | null;
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
  const totalMarketValue = sumKnownAmounts([officialMarketValue, externalMarketValue]);

  return {
    totalMarketValue,
    officialMarketValue,
    externalMarketValue,
    officialSharePct:
      totalMarketValue !== null && totalMarketValue > 0 && officialMarketValue !== null
        ? (officialMarketValue / totalMarketValue) * 100
        : null,
    externalSharePct:
      totalMarketValue !== null && totalMarketValue > 0 && externalMarketValue !== null
        ? (externalMarketValue / totalMarketValue) * 100
        : null,
    officialPositionCount: positions.length,
    externalPositionCount: externalAssets.positions.length,
    missingMarketValueCount:
      positions.filter((position) => position.marketValue === null).length
      + externalAssets.missingMarketValueCount,
  };
}
