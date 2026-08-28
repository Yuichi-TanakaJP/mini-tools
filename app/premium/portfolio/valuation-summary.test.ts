import { describe, expect, it } from "vitest";
import { emptyExternalAssets, loadedExternalAssets } from "./external-assets";
import type { PortfolioExternalAssetPosition, PortfolioExternalAssetSnapshot, PortfolioPosition } from "./types";
import { summarizePortfolioValuation } from "./valuation-summary";

const officialPosition: PortfolioPosition = {
  id: "official-position",
  accountId: "official-account",
  instrumentId: "official-instrument",
  assetType: "domestic_stock",
  identifier: "1605",
  name: "INPEX",
  accountName: "証券口座",
  accountType: "taxable",
  institutionName: "証券会社",
  quantity: 10,
  unitCost: 1900,
  quotedPrice: 2200,
  quoteUnit: 1,
  costBasis: 19000,
  marketValue: 22000,
  unrealizedPnl: 3000,
  distributionMethod: null,
};

const externalSnapshot: PortfolioExternalAssetSnapshot = {
  id: "external-snapshot",
  asOf: "2026-08-23T00:00:00Z",
  status: "ready",
  sourceType: "manual",
  importedAt: "2026-08-23T00:01:00Z",
  portfolioScope: "external_reference",
  sourceLabel: "外部口座",
};

const externalPosition: PortfolioExternalAssetPosition = {
  id: "external-position",
  accountId: "external-account",
  instrumentId: "external-instrument",
  assetType: "investment_fund",
  identifier: "FUND-1",
  name: "外部ファンド",
  stockId: null,
  accountName: "年金口座",
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

describe("summarizePortfolioValuation", () => {
  it("公式保有と外部参照資産の評価額を総資産として合算する", () => {
    const result = summarizePortfolioValuation(
      [officialPosition],
      loadedExternalAssets(externalSnapshot, [externalPosition]),
    );

    expect(result).toEqual({
      totalMarketValue: 122000,
      officialMarketValue: 22000,
      externalMarketValue: 100000,
      officialPositionCount: 1,
      externalPositionCount: 1,
      missingMarketValueCount: 0,
    });
  });

  it("外部資産未登録なら公式保有だけを総資産として表示する", () => {
    expect(summarizePortfolioValuation([officialPosition], emptyExternalAssets())).toMatchObject({
      totalMarketValue: 22000,
      officialMarketValue: 22000,
      externalMarketValue: null,
    });
  });

  it("評価額未取得のposition件数を総資産の注意表示へ渡す", () => {
    const result = summarizePortfolioValuation(
      [{ ...officialPosition, marketValue: null }],
      loadedExternalAssets(externalSnapshot, [{ ...externalPosition, marketValue: null }]),
    );

    expect(result.totalMarketValue).toBeNull();
    expect(result.missingMarketValueCount).toBe(2);
  });
});
