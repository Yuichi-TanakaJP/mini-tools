import { describe, expect, it } from "vitest";
import { getPortfolioAllocation } from "./allocation";
import type { PortfolioInstrumentAnalysis, PortfolioPosition } from "./types";

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: "position-1",
    accountId: "account-1",
    instrumentId: "instrument-1",
    assetType: "domestic_stock",
    identifier: "1111",
    name: "テスト株",
    accountName: "NISA",
    accountType: "nisa_growth",
    institutionName: "証券会社",
    quantity: 10,
    unitCost: 100,
    quotedPrice: 120,
    quoteUnit: 1,
    costBasis: 1000,
    marketValue: 1200,
    unrealizedPnl: 200,
    distributionMethod: null,
    ...overrides,
  };
}

const analysis: PortfolioInstrumentAnalysis = {
  instrumentId: "instrument-1",
  stockId: "stock-1",
  sector33Code: "electric",
  sector33Name: "電気機器",
  cycleProfile: "cyclical",
  incomeProfile: "balanced",
  marketCapProfile: "large",
};

describe("getPortfolioAllocation", () => {
  it("同一銘柄を口座横断で合算し、口座種別では分離する", () => {
    const positions = [
      position(),
      position({ id: "position-2", accountId: "account-2", accountType: "taxable", accountName: "課税口座", marketValue: 300 }),
    ];

    const byInstrument = getPortfolioAllocation({ positions, instrumentAnalysis: [analysis], dimension: "instrument", scope: "all" });
    expect(byInstrument.items).toHaveLength(1);
    expect(byInstrument.items[0]).toMatchObject({ marketValue: 1500, positionCount: 2, instrumentCount: 1, percentage: 100 });

    const byAccount = getPortfolioAllocation({ positions, instrumentAnalysis: [analysis], dimension: "account_type", scope: "all" });
    expect(byAccount.items.map((item) => item.marketValue)).toEqual([1200, 300]);
  });

  it("分類欠損を未分類として分母に残す", () => {
    const result = getPortfolioAllocation({
      positions: [position(), position({ id: "position-2", instrumentId: "instrument-2", marketValue: 800 })],
      instrumentAnalysis: [analysis],
      dimension: "cycle_profile",
      scope: "all",
    });

    expect(result.items).toEqual([
      expect.objectContaining({ key: "cyclical", marketValue: 1200, percentage: 60, isUnclassified: false }),
      expect.objectContaining({ key: "unclassified", marketValue: 800, percentage: 40, isUnclassified: true }),
    ]);
    expect(result.items.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  });

  it("個別株のみでは他資産を除外し、評価額未取得を0円と扱わない", () => {
    const result = getPortfolioAllocation({
      positions: [
        position(),
        position({ id: "fund", instrumentId: "fund-1", assetType: "investment_fund", marketValue: 5000 }),
        position({ id: "missing", instrumentId: "stock-2", assetType: "foreign_stock", marketValue: null }),
      ],
      instrumentAnalysis: [analysis],
      dimension: "sector_33",
      scope: "equity",
    });

    expect(result.totalMarketValue).toBe(1200);
    expect(result.missingMarketValueCount).toBe(1);
    expect(result.items).toEqual([expect.objectContaining({ label: "電気機器", percentage: 100 })]);
  });

  it("空配列と0円を安全に扱う", () => {
    expect(getPortfolioAllocation({ positions: [], instrumentAnalysis: [], dimension: "asset_type", scope: "all" })).toEqual({
      totalMarketValue: 0,
      missingMarketValueCount: 0,
      items: [],
    });

    const zero = getPortfolioAllocation({ positions: [position({ marketValue: 0 })], instrumentAnalysis: [], dimension: "asset_type", scope: "all" });
    expect(zero.items[0].percentage).toBe(0);
  });
});
