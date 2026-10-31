import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { activeSummary, selectionForSummary, summarizeAssetCategory } from "./summary-selection";
import PortfolioSummaryCards from "./PortfolioSummaryCards";
import { emptyExternalAssets } from "./external-assets";
import type { PortfolioData, PortfolioPosition } from "./types";

function position(id: string, assetType: string, marketValue: number | null): PortfolioPosition {
  return { id, instrumentId: id, assetType, marketValue, quantity: 1, quantityKnown: true, identifier: id, name: "合成商品", accountId: "a", accountName: "合成口座", accountType: "taxable", institutionName: "合成", unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, unrealizedPnl: null, distributionMethod: null };
}
const positions = [position("jp", "domestic_stock", 100), position("us", "foreign_stock", 200), position("fund", "investment_fund", 300), position("etf", "equity_fund", 400), position("cash", "cash", 500)];

describe("サマリー対象と評価額", () => {
  it("株式は国内+海外、投信は登録分類のみ。ETF/現金を混ぜない", () => {
    expect(summarizeAssetCategory(positions, ["domestic_stock", "foreign_stock"], true)).toMatchObject({ amount: 300, instrumentCount: 2 });
    expect(summarizeAssetCategory(positions, ["investment_fund"], true)).toMatchObject({ amount: 300, instrumentCount: 1 });
  });
  it("同じ商品を複数口座で持つ場合は評価額を合算し、商品数は重複させない", () => {
    const result = summarizeAssetCategory([positions[0], { ...positions[0], id: "other-account", marketValue: 200 }], ["domestic_stock"], true);
    expect(result).toMatchObject({ amount: 300, instrumentCount: 1, positionCount: 2 });
  });
  it("未取込/全額未取得/既知0/対象なしを区別する", () => {
    expect(summarizeAssetCategory([], ["investment_fund"], false).amount).toBeNull();
    expect(summarizeAssetCategory([], ["investment_fund"], true).amount).toBe(0);
    expect(summarizeAssetCategory([position("x", "investment_fund", null)], ["investment_fund"], true)).toMatchObject({ amount: null, missingCount: 1 });
    expect(summarizeAssetCategory([position("x", "investment_fund", 0)], ["investment_fund"], true)).toMatchObject({ amount: 0, missingCount: 0 });
  });
  it("一部未取得は既知和と除外件数を返し、非有限値を使わない", () => {
    const mixed = [position("a", "investment_fund", 50), position("b", "investment_fund", null), position("c", "investment_fund", NaN)];
    expect(summarizeAssetCategory(mixed, ["investment_fund"], true)).toMatchObject({ amount: 50, missingCount: 2 });
  });
  it("カード選択は対象scopeと分類を揃え、手動変更後の選択状態も一致する", () => {
    expect(activeSummary("assets", selectionForSummary("assets"))).toBe("assets");
    expect(activeSummary("assets", selectionForSummary("equity"))).toBe("equity");
    expect(activeSummary("assets", selectionForSummary("funds"))).toBe("funds");
    expect(activeSummary("assets", { ...selectionForSummary("funds"), dimension: "sector_33", key: null })).toBe("assets");
    expect(activeSummary("dividends", selectionForSummary("funds"))).toBe("dividends");
    expect(selectionForSummary("dividends")).toMatchObject({ dimension: "asset_type", scope: "all", key: null });
  });
  it("投信が外部だけにあっても登録投信カードを有効にしない", () => {
    const data = { positions: [positions[0]], currentSnapshot: { id: "s" }, externalAssets: { ...emptyExternalAssets(), totalMarketValue: 900 } } as unknown as PortfolioData;
    const html = renderToStaticMarkup(createElement(PortfolioSummaryCards, { data, active: "assets", onSelect: () => {} }));
    expect(html).toContain('disabled=""'); expect(html).toContain("対象なし");
    expect(html).toContain("登録保有＋外部参照");
    expect(html).not.toContain("取得額（公式保有）"); expect(html).not.toContain("含み損益（公式保有）");
  });
});

it("外部参照の取得失敗を全体の完全評価額と誤認させない", () => {
  const data = { positions: [positions[0]], currentSnapshot: { id: "s" }, externalAssets: { ...emptyExternalAssets(), status: "error" } } as unknown as PortfolioData;
  const html = renderToStaticMarkup(createElement(PortfolioSummaryCards, { data, active: "assets", onSelect: () => {} }));
  expect(html).toContain("総資産評価額（取得分）");
  expect(html).toContain("外部参照は未取得・登録保有分のみ");
});
