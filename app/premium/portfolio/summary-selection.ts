import type { PortfolioAllocationDimension, PortfolioAllocationScope } from "./allocation";
import type { PortfolioPosition } from "./types";

export type SummaryTarget = "assets" | "dividends" | "equity" | "funds";
export type AnalysisSelection = { dimension: PortfolioAllocationDimension; scope: PortfolioAllocationScope; key: string | null };

export function selectionForSummary(target: SummaryTarget): AnalysisSelection {
  return { dimension: "asset_type", scope: target === "equity" ? "equity" : "all", key: target === "funds" ? "bucket:investment_fund" : null };
}

export function activeSummary(content: "assets" | "dividends", selection: AnalysisSelection): SummaryTarget {
  if (content === "dividends") return "dividends";
  if (selection.scope === "equity") return "equity";
  return selection.dimension === "asset_type" && selection.key === "bucket:investment_fund" ? "funds" : "assets";
}

export function summarizeAssetCategory(positions: PortfolioPosition[], assetTypes: string[], hasSnapshot: boolean) {
  const selected = positions.filter((p) => assetTypes.includes(p.assetType));
  const known = selected.filter((p) => p.marketValue !== null && Number.isFinite(p.marketValue));
  return {
    amount: !hasSnapshot ? null : known.length > 0 ? known.reduce((sum, p) => sum + p.marketValue!, 0) : selected.length === 0 ? 0 : null,
    instrumentCount: new Set(selected.map((p) => p.instrumentId)).size,
    positionCount: selected.length,
    missingCount: selected.length - known.length,
  };
}
