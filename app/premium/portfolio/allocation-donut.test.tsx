import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Card from "./PortfolioAnalysisCard";
import { portfolioAllocationDimensions } from "./allocation";
import type { PortfolioData, PortfolioInstrumentAnalysis, PortfolioPosition } from "./types";

// SSR state coverage only; real select/button interaction is covered by browser UAT.
const state = vi.hoisted(() => ({ values: [] as string[], cursor: 0 }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(state.values[state.cursor++] ?? initial) };
});
const positions: PortfolioPosition[] = Array.from({ length: 15 }, (_, i) => ({
  id: `p${i}`, accountId: "account", instrumentId: `i${i}`, assetType: i === 14 ? "investment_fund" : "domestic_stock",
  identifier: `TEST${i}`, name: `合成商品${i}`, accountName: "合成口座", accountType: "taxable", institutionName: "合成証券",
  quantity: 1, unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, marketValue: 100, unrealizedPnl: null, distributionMethod: null,
}));
const instrumentAnalysis: PortfolioInstrumentAnalysis[] = positions.slice(0, 13).map((p, i) => ({
  instrumentId: p.instrumentId, stockId: null, sector33Code: `s${i}`, sector33Name: `合成業種${i}`,
  cycleProfile: i % 2 ? "cyclical" : "defensive", incomeProfile: "balanced", marketCapProfile: "large",
}));
function render(overrides: Partial<PortfolioData> = {}) {
  state.cursor = 0;
  return renderToStaticMarkup(createElement(Card, { data: { positions, instrumentAnalysis, instrumentAnalysisStatus: "loaded", ...overrides } as PortfolioData }));
}
beforeEach(() => { state.values = []; state.cursor = 0; });
describe("保有構成ドーナツ", () => {
  it("業種/個別株を初期表示し、14分類と未分類を省略せず表示する", () => {
    const html = render();
    expect(html).toContain('value="sector_33" selected=""');
    expect(html).toContain('東証33業種 / 個別株のみ。');
    expect(html).toContain('14分類');
    for (let i = 0; i < 13; i++) expect(html).toContain(`合成業種${i}`);
    expect(html).toContain('未分類 7.1%');
    expect(html).not.toContain('その他  ');
    expect(html).toContain('外部参照資産は対象外');
  });
  it.each(Object.keys(portfolioAllocationDimensions))("%sを多分類でもドーナツで表示する", (dimension) => {
    state.values = [dimension, "all"];
    const html = render();
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('登録保有全体。');
    if (dimension === "instrument") expect(html).toContain('15分類');
  });
  it("分類取得失敗は図を出さず、非分類軸へ切替可能と表示する", () => {
    expect(render({ instrumentAnalysisStatus: "error" })).not.toContain('<svg');
    expect(render({ instrumentAnalysisStatus: "error" })).toContain('分類情報を取得できませんでした');
    state.values = ["asset_type", "all"];
    expect(render({ instrumentAnalysisStatus: "error" })).toContain('<svg');
    state.values = ["sector_33", "equity"];
    expect(render({ instrumentAnalysisStatus: "error" })).not.toContain('<svg');
  });
  it("評価額なし/0円だけでは図を出さず、未取得件数を示す", () => {
    const html = render({ positions: [{ ...positions[0], marketValue: null }, { ...positions[1], marketValue: 0 }] });
    expect(html).not.toContain('<svg');
    expect(html).toContain('評価額未取得 1件');
  });
});
