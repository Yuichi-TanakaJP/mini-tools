import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Card from "./PortfolioAnalysisCard";
import Holdings from "./PortfolioHoldingsAnalysis";
import { portfolioAllocationDimensions, type PortfolioAllocationDimension } from "./allocation";
import { buildAnalysisGroups } from "./linked-analysis";
import type { PortfolioData, PortfolioInstrumentAnalysis, PortfolioPosition } from "./types";

const positions: PortfolioPosition[] = Array.from({ length: 15 }, (_, i) => ({
  id: `p${i}`, accountId: "account", instrumentId: `i${i}`, assetType: i === 14 ? "investment_fund" : "domestic_stock",
  identifier: `TEST${i}`, name: `合成商品${i}`, accountName: "合成口座", accountType: "taxable", institutionName: "合成証券",
  quantity: 1, unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, marketValue: 100, unrealizedPnl: null, distributionMethod: null,
}));
const analysis: PortfolioInstrumentAnalysis[] = positions.slice(0, 13).map((p, i) => ({ instrumentId: p.instrumentId, stockId: null, sector33Code: `s${i}`, sector33Name: `合成業種${i}`, cycleProfile: i % 2 ? "cyclical" : "defensive", incomeProfile: "balanced", marketCapProfile: "large" }));
function render(dimension: PortfolioAllocationDimension = "sector_33", overrides: Partial<PortfolioData> = {}) {
  const data = { positions, instrumentAnalysis: analysis, instrumentAnalysisStatus: "loaded", ...overrides } as PortfolioData;
  const model = buildAnalysisGroups(data.positions, data.instrumentAnalysis, dimension, "equity");
  return renderToStaticMarkup(createElement(Card, { data, dimension, scope: "equity", selectedKey: null, groups: model.visible, allGroups: model.all, total: model.total, onDimension: () => {}, onScope: () => {}, onSelect: () => {} }));
}
describe("保有構成ドーナツ", () => {
  it("7軸を常時button表示し、多分類を集約して全明細と未分類を残す", () => {
    const html = render();
    expect(html).not.toContain("<select");
    expect(html).toContain('role="group" aria-label="分析軸"');
    for (const item of Object.values(portfolioAllocationDimensions)) expect(html).toContain(item.label);
    expect(html).toContain('aria-pressed="true">東証33業種');
    expect(html).toContain('その他 7分類');
    expect(html.match(/stroke-dasharray=/g)).toHaveLength(8);
    for (let i = 0; i < 13; i++) expect(html).toContain(`合成業種${i}`);
    expect(html).toContain('未分類 7.1%');
  });
  it.each(Object.keys(portfolioAllocationDimensions) as PortfolioAllocationDimension[])("%sでもドーナツと連動説明を維持する", (dimension) => {
    const html = render(dimension);
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('下の配当・商品構成も同じ範囲');
  });
  it("分類取得失敗を未分類100%にせず、非分類軸で表示できる", () => {
    expect(render("sector_33", { instrumentAnalysisStatus: "error" })).not.toContain('<svg');
    expect(render("asset_type", { instrumentAnalysisStatus: "error" })).toContain('<svg');
  });
  it("評価額なし/0円だけは図を出さず、商品を除外しないと説明する", () => {
    const html = render("sector_33", { positions: [{ ...positions[0], marketValue: null }, { ...positions[1], marketValue: 0 }] });
    expect(html).not.toContain('<svg');
    expect(html).toContain('評価額未取得 1件');
    expect(html).toContain('商品一覧には残します');
  });
});

it("保有分析の初期表示は資産クラスAllで、株・投信・現金を対象にする", () => {
  const assetTypes = ["domestic_stock", "foreign_stock", "investment_fund", "cash"];
  const mixed = assetTypes.map((assetType, i) => ({ ...positions[0], id: `all${i}`, instrumentId: `all${i}`, assetType, name: `初期確認商品${i}`, quantityKnown: true }));
  const data = { positions: mixed, instrumentAnalysis: [], instrumentAnalysisStatus: "loaded" } as unknown as PortfolioData;
  const html = renderToStaticMarkup(createElement(Holdings, { data }));
  expect(html).toMatch(/aria-pressed="true"[^>]*>資産クラス/);
  expect(html).toMatch(/aria-pressed="true"[^>]*>登録保有全体/);
  expect(html).toContain("登録保有全体 ／ 資産クラス ／ すべて");
  for (let i = 0; i < mixed.length; i++) expect(html).toContain(`初期確認商品${i}`);
  for (const label of ["国内株", "海外株", "投資信託", "現金"]) expect(html).toContain(label);
});
