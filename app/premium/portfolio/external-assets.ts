import type { PortfolioExternalAssetPosition, PortfolioExternalAssetSnapshot, PortfolioExternalAssets } from "./types";

const stockReferenceAssetTypes = new Set(["domestic_stock", "foreign_stock"]);

export function isUnresolvedExternalInstrument(position: PortfolioExternalAssetPosition): boolean {
  return position.stockId === null && stockReferenceAssetTypes.has(position.assetType ?? "");
}

export function emptyExternalAssets(): PortfolioExternalAssets {
  return {
    status: "empty",
    snapshot: null,
    positions: [],
    totalMarketValue: null,
    missingMarketValueCount: 0,
    unresolvedInstrumentCount: 0,
    errorMessage: null,
  };
}

export function externalAssetsError(
  message = "外部資産データを取得できませんでした。",
  snapshot: PortfolioExternalAssetSnapshot | null = null,
): PortfolioExternalAssets {
  return {
    ...emptyExternalAssets(),
    status: "error",
    snapshot,
    errorMessage: message,
  };
}

export function externalAssetsLoading(snapshot: PortfolioExternalAssetSnapshot): PortfolioExternalAssets {
  return {
    ...emptyExternalAssets(),
    status: "loading",
    snapshot,
  };
}

export function loadedExternalAssets(
  snapshot: PortfolioExternalAssetSnapshot,
  positions: PortfolioExternalAssetPosition[],
  warningMessage: string | null = null,
): PortfolioExternalAssets {
  const knownMarketValues = positions
    .map((position) => position.marketValue)
    .filter((value): value is number => value !== null);

  return {
    status: "loaded",
    snapshot,
    positions,
    totalMarketValue: knownMarketValues.length > 0 ? knownMarketValues.reduce((sum, value) => sum + value, 0) : null,
    missingMarketValueCount: positions.filter((position) => position.marketValue === null).length,
    unresolvedInstrumentCount: positions.filter(isUnresolvedExternalInstrument).length,
    errorMessage: warningMessage,
  };
}
