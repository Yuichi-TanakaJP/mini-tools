import { describe, expect, it } from "vitest";
import { aggregatePortfolioPositions, sumCompleteAmounts } from "./aggregates";
import type { PortfolioPosition } from "./types";

function position(overrides: Partial<PortfolioPosition>): PortfolioPosition {
  return {
    id: "position-1",
    accountId: "account-1",
    instrumentId: "instrument-1605",
    assetType: "domestic_stock",
    identifier: "1605",
    name: "INPEX",
    accountName: "NISA",
    accountType: "nisa_growth",
    institutionName: "証券会社",
    quantity: 96,
    unitCost: 1927,
    quotedPrice: 2200,
    quoteUnit: 1,
    costBasis: 184992,
    marketValue: 211200,
    unrealizedPnl: 26208,
    distributionMethod: null,
    ...overrides,
  };
}

describe("aggregatePortfolioPositions", () => {
  it("同一商品を複数口座で保有しても数量と金額を商品単位で合算する", () => {
    const result = aggregatePortfolioPositions([
      position({}),
      position({
        id: "position-2",
        accountId: "account-2",
        accountName: "課税口座",
        accountType: "taxable",
        quantity: 10,
        unitCost: 2000,
        costBasis: 20000,
        marketValue: 22000,
        unrealizedPnl: 2000,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      instrumentId: "instrument-1605",
      quantity: 106,
      costBasis: 204992,
      marketValue: 233200,
      unrealizedPnl: 28208,
      accounts: ["NISA", "課税口座"],
    });
  });

  it("正本の商品IDが異なるpositionは識別子が同じでも混同しない", () => {
    const result = aggregatePortfolioPositions([
      position({}),
      position({ id: "position-2", instrumentId: "instrument-other", accountName: "課税口座" }),
    ]);

    expect(result).toHaveLength(2);
  });

  it("一部口座の金額が未取得なら部分合計を表示しない", () => {
    const result = aggregatePortfolioPositions([
      position({}),
      position({ id: "position-2", accountName: "課税口座", marketValue: null }),
    ]);

    expect(result[0].marketValue).toBeNull();
  });
});

describe("sumCompleteAmounts", () => {
  it("複数口座の金額を合計する", () => {
    expect(sumCompleteAmounts([211200, 22000])).toBe(233200);
  });

  it("一部口座の金額が未取得なら部分合計を返さない", () => {
    expect(sumCompleteAmounts([211200, null])).toBeNull();
  });
});
