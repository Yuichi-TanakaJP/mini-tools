import { describe, expect, it } from "vitest";
import { emptyExternalAssets, externalAssetsError, externalAssetsLoading, loadedExternalAssets } from "./external-assets";
import type { PortfolioExternalAssetPosition, PortfolioExternalAssetSnapshot } from "./types";

const snapshot: PortfolioExternalAssetSnapshot = {
  id: "external-snapshot",
  asOf: "2026-08-18T00:00:00Z",
  status: "ready",
  sourceType: "manual",
  importedAt: "2026-08-18T00:01:00Z",
  portfolioScope: "external_reference",
  sourceLabel: "iDeCo明細",
};

const position: PortfolioExternalAssetPosition = {
  id: "external-position",
  accountId: "account-1",
  instrumentId: "instrument-1",
  assetType: "investment_fund",
  identifier: "FUND-1",
  name: "外部ファンド",
  stockId: null,
  accountName: "iDeCo",
  accountType: "ideco",
  institutionName: "年金運営会社",
  withdrawalProfile: "retirement_locked",
  valuationMode: "balance",
  quantity: null,
  nativeMarketValue: 100000,
  nativeCurrency: "JPY",
  marketValue: 100000,
  costBasis: null,
  costBasisNative: null,
  fxRate: null,
  fxAsOf: null,
  fxSource: null,
  note: null,
};

describe("external asset display model", () => {
  it("正常な外部資産を集計する", () => {
    expect(loadedExternalAssets(snapshot, [position])).toMatchObject({ status: "loaded", totalMarketValue: 100000, missingMarketValueCount: 0, unresolvedInstrumentCount: 0 });
    expect(loadedExternalAssets(snapshot, [{ ...position, assetType: "domestic_stock" }])).toMatchObject({ unresolvedInstrumentCount: 1 });
  });

  it("未登録と取得失敗を別状態で返す", () => {
    expect(emptyExternalAssets()).toMatchObject({ status: "empty", snapshot: null, positions: [] });
    expect(externalAssetsError()).toMatchObject({ status: "error", snapshot: null, positions: [] });
    expect(externalAssetsLoading(snapshot)).toMatchObject({ status: "loading", snapshot, positions: [] });
  });

  it("評価額未取得を0円として集計しない", () => {
    const result = loadedExternalAssets(snapshot, [{ ...position, marketValue: null }]);
    expect(result.totalMarketValue).toBeNull();
    expect(result.missingMarketValueCount).toBe(1);
  });
});
