import { describe, expect, it } from "vitest";
import { summarizePortfolioDbResult } from "./db-check";
import type { PortfolioData } from "./types";

const baseData: PortfolioData = {
  authState: "authenticated",
  portfolio: { id: "portfolio-1", name: "メイン", baseCurrency: "JPY" },
  snapshots: [{ id: "snapshot-1", asOf: "2026-08-14T00:00:00Z", status: "ready", sourceType: "broker_csv", importedAt: "2026-08-14T00:01:00Z" }],
  currentSnapshot: { id: "snapshot-1", asOf: "2026-08-14T00:00:00Z", status: "ready", sourceType: "broker_csv", importedAt: "2026-08-14T00:01:00Z" },
  dbPositionSnapshot: { id: "snapshot-1", asOf: "2026-08-14T00:00:00Z", status: "ready", sourceType: "broker_csv", importedAt: "2026-08-14T00:01:00Z" },
  positions: [
    { id: "position-1", accountId: "account-nisa", instrumentId: "instrument-1605", assetType: "domestic_stock", identifier: "1605", name: "INPEX", accountName: "NISA", accountType: "nisa_growth", institutionName: "証券会社", quantity: 96, unitCost: 1927, quotedPrice: 2200, quoteUnit: 1, costBasis: 184992, marketValue: 211200, unrealizedPnl: 26208, distributionMethod: null },
    { id: "position-2", accountId: "account-taxable", instrumentId: "instrument-1605", assetType: "domestic_stock", identifier: "1605", name: "INPEX", accountName: "課税口座", accountType: "taxable", institutionName: "証券会社", quantity: 10, unitCost: 2000, quotedPrice: 2200, quoteUnit: 1, costBasis: 20000, marketValue: 22000, unrealizedPnl: 2000, distributionMethod: null },
  ],
  dbPositions: [
    { id: "position-1", accountId: "account-nisa", instrumentId: "instrument-1605", assetType: "domestic_stock", identifier: "1605", name: "INPEX", accountName: "NISA", accountType: "nisa_growth", institutionName: "証券会社", quantity: 96, unitCost: 1927, quotedPrice: 2200, quoteUnit: 1, costBasis: 184992, marketValue: 211200, unrealizedPnl: 26208, distributionMethod: null },
    { id: "position-2", accountId: "account-taxable", instrumentId: "instrument-1605", assetType: "domestic_stock", identifier: "1605", name: "INPEX", accountName: "課税口座", accountType: "taxable", institutionName: "証券会社", quantity: 10, unitCost: 2000, quotedPrice: 2200, quoteUnit: 1, costBasis: 20000, marketValue: 22000, unrealizedPnl: 2000, distributionMethod: null },
  ],
  review: { id: "review-1", title: "8月レビュー", status: "draft", asOf: "2026-08-14T00:02:00Z", newCapitalAmount: 100000, summary: null, allocationPolicy: null, updatedAt: "2026-08-14T00:02:00Z", items: [] },
  dbCounts: { portfolio: 1, snapshots: 1, accounts: 2, instruments: 1, positions: 2, reviews: 1, reviewItems: 0 },
  source: "server",
};

describe("summarizePortfolioDbResult", () => {
  it("読み込んだportfolio・snapshot・reviewの件数をまとめる", () => {
    const summary = summarizePortfolioDbResult(baseData);

    expect(summary).toMatchObject({
      loadState: "loaded",
      portfolioId: "portfolio-1",
      snapshotCount: 1,
      positionCount: 2,
      instrumentCount: 1,
      accountCount: 2,
      reviewCount: 1,
      reviewId: "review-1",
    });
  });

  it("表示用に除外された行も取得クエリの件数として残す", () => {
    const summary = summarizePortfolioDbResult({
      ...baseData,
      positions: baseData.positions.slice(0, 1),
      dbCounts: { ...baseData.dbCounts, positions: 3, reviewItems: 2 },
    });

    expect(summary).toMatchObject({ positionCount: 3, reviewItemCount: 2 });
  });

  it("未取込状態を空状態として区別する", () => {
    const summary = summarizePortfolioDbResult({
      ...baseData,
      portfolio: { id: null, name: null, baseCurrency: "JPY" },
      snapshots: [],
      currentSnapshot: null,
      positions: [],
      review: null,
      dbCounts: { portfolio: 0, snapshots: 0, accounts: 0, instruments: 0, positions: 0, reviews: 0, reviewItems: 0 },
      source: "empty",
    });

    expect(summary).toMatchObject({ loadState: "empty", snapshotCount: 0, positionCount: 0, reviewCount: 0 });
  });

  it("認証必須状態を読み込み済みと扱わない", () => {
    const summary = summarizePortfolioDbResult({ ...baseData, authState: "required" });

    expect(summary.loadState).toBe("auth_required");
  });

  it("import履歴はあるがready snapshotがない状態を区別する", () => {
    const summary = summarizePortfolioDbResult({
      ...baseData,
      snapshots: [{ ...baseData.snapshots[0], status: "failed" }],
      currentSnapshot: null,
      positions: [],
      review: null,
      dbCounts: { portfolio: 1, snapshots: 1, accounts: 0, instruments: 0, positions: 0, reviews: 0, reviewItems: 0 },
      source: "empty",
    });

    expect(summary.loadState).toBe("no_ready_snapshot");
  });
});
