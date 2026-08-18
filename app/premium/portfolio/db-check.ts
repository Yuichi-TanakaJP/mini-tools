import type { PortfolioData } from "./types";

export type PortfolioDbCheckSummary = {
  loadState: "auth_required" | "empty" | "no_ready_snapshot" | "loaded";
  source: PortfolioData["source"];
  portfolioId: string | null;
  portfolioName: string | null;
  baseCurrency: string;
  snapshotCount: number;
  currentSnapshotId: string | null;
  currentSnapshotStatus: NonNullable<PortfolioData["currentSnapshot"]>["status"] | null;
  currentSnapshotAsOf: string | null;
  positionCount: number;
  instrumentCount: number;
  accountCount: number;
  reviewCount: number;
  reviewId: string | null;
  reviewStatus: NonNullable<PortfolioData["review"]>["status"] | null;
  reviewItemCount: number;
};

export function summarizePortfolioDbResult(data: PortfolioData): PortfolioDbCheckSummary {
  const instrumentIds = new Set(data.positions.map((position) => position.instrumentId));
  const accountIds = new Set(data.positions.map((position) => position.accountId));
  const loadState = data.authState === "required"
    ? "auth_required"
    : data.source === "server"
      ? "loaded"
      : data.snapshots.length > 0
        ? "no_ready_snapshot"
        : "empty";

  return {
    loadState,
    source: data.source,
    portfolioId: data.portfolio.id,
    portfolioName: data.portfolio.name,
    baseCurrency: data.portfolio.baseCurrency,
    snapshotCount: data.snapshots.length,
    currentSnapshotId: data.currentSnapshot?.id ?? null,
    currentSnapshotStatus: data.currentSnapshot?.status ?? null,
    currentSnapshotAsOf: data.currentSnapshot?.asOf ?? null,
    positionCount: data.positions.length,
    instrumentCount: instrumentIds.size,
    accountCount: accountIds.size,
    reviewCount: data.review ? 1 : 0,
    reviewId: data.review?.id ?? null,
    reviewStatus: data.review?.status ?? null,
    reviewItemCount: data.review?.items.length ?? 0,
  };
}
