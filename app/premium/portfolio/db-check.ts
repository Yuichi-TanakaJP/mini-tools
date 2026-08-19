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
    snapshotCount: data.dbCounts.snapshots,
    currentSnapshotId: data.currentSnapshot?.id ?? null,
    currentSnapshotStatus: data.currentSnapshot?.status ?? null,
    currentSnapshotAsOf: data.currentSnapshot?.asOf ?? null,
    positionCount: data.dbCounts.positions,
    instrumentCount: data.dbCounts.instruments,
    accountCount: data.dbCounts.accounts,
    reviewCount: data.dbCounts.reviews,
    reviewId: data.review?.id ?? null,
    reviewStatus: data.review?.status ?? null,
    reviewItemCount: data.dbCounts.reviewItems,
  };
}
