import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dividendDisplay } from "./dividend-display";
import { emptyDomesticDividendProjection, type DomesticDividendProjection } from "./dividend-income";
import PortfolioIncomeSummary from "./PortfolioIncomeSummary";
import PortfolioDividendComposition from "./PortfolioDividendComposition";
import { buildAnalysisGroups, selectDividendProjection } from "./linked-analysis";
import type { PortfolioPosition } from "./types";

function source(): DomesticDividendProjection {
  return { ...emptyDomesticDividendProjection("ready", "2026-10-31"), sourceIntegrity: true, expectedStocks: 1, coveredStocks: 1, projectedAnnualGross: 4000,
    positions: [{ instrumentId: "i1", ticker: "TEST", name: "合成", quantity: 400, actualDps: null, forecastDps: 10, rawForecastDps: 10, cashProjectionStatus: "resolved", forecastAsOf: "2026-10-01", annualGross: 4000, priorRunRateGross: null, rateEffectGross: null, changeType: "not_comparable" }] };
}
const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return { id: "p1", accountId: "a1", instrumentId: "i1", identifier: "TEST", name: "合成", assetType: "domestic_stock", quantity: 100, quantityKnown: true, marketValue: 900, accountName: "合成口座", accountType: "taxable", institutionName: "合成", unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, unrealizedPnl: null, distributionMethod: null, ...overrides };
}

describe("配当の上部サマリーと構成グラフ", () => {
  it("部分和を確認済み分と明記して主表示し、全体合計とは区別する", () => {
    const p = { ...source(), status: "incomplete" as const, expectedStocks: 2, projectedAnnualGross: null };
    expect(dividendDisplay(p)).toMatchObject({ confirmedGross: 4000, completeTotal: null, missingCount: 1 });
    const html = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: p }));
    expect(html).toContain("年間予想配当（確認済み分）");
    expect(html).toContain(`>${yen(4000)}</div>`);
    expect(html).toContain("全体合計は未確定");
    expect(html).toContain("未確認 1銘柄");
    expect(html).not.toContain(">—</div>");
  });
  it("完全合計はDB契約のready値だけを表示し、既知無配0円と未知を区別する", () => {
    const p = source(); p.projectedAnnualGross = 0; p.positions[0].annualGross = 0; p.positions[0].forecastDps = 0;
    expect(dividendDisplay(p)).toMatchObject({ completeTotal: 0, confirmedGross: 0 });
    for (const status of ["no_snapshot", "no_domestic_stocks", "error"] as const) expect(dividendDisplay({ ...p, status }).confirmedGross).toBeNull();
    expect(dividendDisplay({ ...p, sourceIntegrity: false }).completeTotal).toBeNull();
    expect(dividendDisplay(undefined).confirmedGross).toBeNull();
  });
  it.each([null, "2026-11-01", "bad"])("確認日%sの行を部分和へ含めない", (forecastAsOf) => {
    const p = source(); p.positions[0].forecastAsOf = forecastAsOf;
    expect(dividendDisplay(p).confirmedGross).toBeNull();
  });
  it.each([-1, NaN, Infinity])("不正額%sを確認済みへ含めない", (annualGross) => {
    const p = source(); p.positions[0].annualGross = annualGross;
    expect(dividendDisplay(p).confirmedGross).toBeNull();
  });
  it("未知数量と元数量不一致を上部の確認済み額へ通さない", () => {
    for (const positions of [[position({ quantityKnown: false, quantity: 400 })], [position({ quantity: 399 })]]) {
      expect(dividendDisplay(selectDividendProjection(source(), positions, positions)).confirmedGross).toBeNull();
    }
  });
  it("配当の棒も評価額9:1でなく株数1:3。未知分類は0棒にしない", () => {
    const positions = [position(), position({ id: "p2", accountId: "a2", accountType: "nisa_growth", quantity: 300, marketValue: 100 })];
    const groups = buildAnalysisGroups(positions, [], "account_type", "all").visible;
    const html = renderToStaticMarkup(createElement(PortfolioDividendComposition, { groups: groups.map((group) => ({ group, projection: selectDividendProjection(source(), positions, group.positions) })), projection: selectDividendProjection(source(), positions, positions), dimensionLabel: "口座", selectedKey: null, onSelect: () => {} }));
    expect(html).toContain("25.0%"); expect(html).toContain("75.0%");
    expect(html).toContain("width:25%"); expect(html).toContain("width:75%");
    const unknown = renderToStaticMarkup(createElement(PortfolioDividendComposition, { groups: groups.map((group) => ({ group, projection: { ...source(), sourceIntegrity: false } })), projection: { ...source(), sourceIntegrity: false }, dimensionLabel: "口座", selectedKey: null, onSelect: () => {} }));
    expect(unknown).toContain("グラフは未表示"); expect(unknown).not.toContain("width:0%");
  });
});

it("同じ分類の確認済み・未確認を区別し、棒の部分和と分母を一致させる", () => {
  const p = source();
  p.status = "incomplete"; p.expectedStocks = 2; p.coveredStocks = 2; p.projectedAnnualGross = null;
  p.positions.push({ ...p.positions[0], instrumentId: "held", quantity: 50, cashProjectionStatus: "share_basis_missing", forecastDps: null, annualGross: null });
  const positions = [position(), position({ id: "p2", accountId: "a2", accountType: "nisa_growth", quantity: 300, marketValue: 100 }), position({ id: "p3", instrumentId: "held", quantity: 50 })];
  const groups = buildAnalysisGroups(positions, [], "account_type", "all").visible;
  const html = renderToStaticMarkup(createElement(PortfolioDividendComposition, { groups: groups.map((group) => ({ group, projection: selectDividendProjection(p, positions, group.positions) })), projection: selectDividendProjection(p, positions, positions), dimensionLabel: "口座種別", selectedKey: null, onSelect: () => {} }));
  expect(html).toContain("口座種別の配当構成"); expect(html).not.toContain("種別別");
  expect(html).toContain(`確認済み分 ${yen(1000)}`); expect(html).toContain(yen(3000));
  expect(html).toContain("25.0%"); expect(html).toContain("75.0%");
  expect(html).toContain("未確認 1銘柄"); expect(html).toContain("この表示範囲の年間合計は未確定");
});

it("上部は全確認なら全額、確認済みなし/取得失敗なら金額を作らない", () => {
  const ready = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: source() }));
  expect(ready).toContain("年間予想配当（国内株）"); expect(ready).not.toContain("年間予想配当（確認済み分）");
  expect(ready).toContain(`>${yen(4000)}</div>`);
  for (const status of ["error", "no_domestic_stocks", "no_snapshot"] as const) {
    const html = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: { ...source(), status } }));
    expect(html).toContain(">—</div>"); expect(html).not.toContain(`>${yen(4000)}</div>`);
  }
});
