import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dividendDisplay, dividendExclusionLabel, reportedPeriodDividend } from "./dividend-display";
import { summarizeDomesticDividendProjection, type DividendProjectionRow } from "./dividend-income";
import { selectDividendProjection, buildAnalysisGroups } from "./linked-analysis";
import PortfolioDividend from "./PortfolioDividend";
import PortfolioIncomeSummary from "./PortfolioIncomeSummary";
import PortfolioDividendComposition from "./PortfolioDividendComposition";
import type { PortfolioPosition } from "./types";

const snapshot = { id: "s", asOf: "2026-10-31T00:00:00Z" };
function row(extra: Partial<DividendProjectionRow> = {}): DividendProjectionRow {
  return { snapshot_id: "s", snapshot_as_of: snapshot.asOf, instrument_id: "i", ticker: "SYNTHETIC", instrument_name: "期間変更の合成銘柄", quantity: 100,
    latest_actual_dps: 10, forecast_dps: null, raw_forecast_dps: 20, cash_projection_status: "non_annual_period", forecast_metric_basis_id: null, forecast_fact_basis_id: "basis",
    forecast_as_of: "2026-10-20", projected_annual_dividend_gross: null, prior_actual_run_rate_gross: null, dividend_rate_effect_gross: null, dividend_change_type: "not_comparable",
    forecast_period_start: "2026-04-01", forecast_period_end: "2026-12-31", forecast_period_months: 9, reported_forecast_dps: 20, reported_forecast_dividend_gross: 2000,
    annual_projection_exclusion_reason: "non_annual_period", dividend_comparison_exclusion_reason: "non_annual_period", ...extra };
}
function source(extra: Partial<DividendProjectionRow> = {}) {
  return summarizeDomesticDividendProjection([row(extra)], snapshot, ["i"], { snapshot_id: "s", snapshot_as_of: snapshot.asOf, holding_count: 1, confirmed_count: 0, held_count: 1, confirmed_partial_total: null, projected_annual_dividend_gross: null, status: "review_required" });
}
function position(extra: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return { id: "p", instrumentId: "i", identifier: "SYNTHETIC", name: "合成銘柄", assetType: "domestic_stock", quantity: 100, quantityKnown: true, marketValue: 1000, accountId: "a", accountName: "合成口座", accountType: "taxable", institutionName: "合成", unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, unrealizedPnl: null, distributionMethod: null, ...extra };
}

describe("対象期の公表予想と年間合計の分離", () => {
  it("9か月の確認済み公表額を未確認と区別し、12/9換算も年間合算もしない", () => {
    const p = source();
    expect(p.positions[0]).toMatchObject({ forecastPeriodStart: "2026-04-01", forecastPeriodEnd: "2026-12-31", forecastPeriodMonths: 9, reportedForecastDps: 20, reportedForecastGross: 2000, annualGross: null });
    expect(dividendDisplay(p)).toMatchObject({ confirmedGross: null, completeTotal: null, excludedCount: 1, unverifiedCount: 0 });
    expect(reportedPeriodDividend(p, p.positions[0])).toMatchObject({ dps: 20, gross: 2000, months: 9 });
    const html = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: p }));
    expect(html).toContain("年間集計対象外 1銘柄"); expect(html).not.toContain("未確認 1銘柄");
  });
  it("表とグラフの別枠に対象期・公表額と比較除外理由を表示する", () => {
    const p = source();
    const html = renderToStaticMarkup(createElement(PortfolioDividend, { projection: p, expandDetails: true }));
    expect(html).toContain("9か月"); expect(html).toContain("2026/04/01"); expect(html).toContain("2026/12/31");
    expect(html).toContain("期間確認済み・年間対象外"); expect(html).toContain("12か月ではない対象期"); expect(html).toContain("￥2,000");
    const groups = buildAnalysisGroups([position()], [], "asset_type", "all").visible;
    const graph = renderToStaticMarkup(createElement(PortfolioDividendComposition, { groups: groups.map(group => ({ group, projection: p })), projection: p, dimensionLabel: "資産クラス", selectedKey: null, onSelect: () => {} }));
    expect(graph).toContain('aria-label="年間集計対象外の公表予想"'); expect(graph).toContain("￥2,000"); expect(graph).not.toContain("width:0%");
  });
  it("口座別は評価額ではなく既知数量で対象期の公表額も配分する", () => {
    const all = [position({ quantity: 25, marketValue: 900 }), position({ id: "p2", accountId: "b", quantity: 75, marketValue: 100 })];
    const scoped = selectDividendProjection(source(), all, [all[0]])!;
    expect(reportedPeriodDividend(scoped, scoped.positions[0])).toMatchObject({ dps: 20, gross: 500 });
    expect(scoped.projectedAnnualGross).toBeNull();
    const unknown = selectDividendProjection(source(), [position({ quantityKnown: false })], [position({ quantityKnown: false })])!;
    expect(reportedPeriodDividend(unknown, unknown.positions[0])).toBeNull();
  });
  it("按分前の公表額が不整合なら、小口選択で誤差が縮んでも確認済みにしない", () => {
    const p = source({ reported_forecast_dividend_gross: 2000.5 });
    expect(reportedPeriodDividend(p, p.positions[0])).toBeNull();
    expect(p.sourceIntegrity).toBe(true); // Annual totals do not certify the separate reported-period amount.
    for (const quantity of [1, 25, 100]) {
      const selected = position({ quantity });
      const scoped = selectDividendProjection(p, [position()], [selected])!;
      expect(reportedPeriodDividend(scoped, scoped.positions[0])).toBeNull();
      expect(dividendDisplay(scoped)).toMatchObject({ excludedCount: 0, unverifiedCount: 1 });
      expect(scoped.positions[0].reportedForecastGross).toBeNull();
    }
  });
  it.each([
    { forecast_as_of: "2026-11-01" }, { forecast_period_months: 12 }, { forecast_period_months: 0 }, { forecast_period_months: 9.5 },
    { forecast_period_end: null }, { forecast_period_end: "2027-12-31" }, { forecast_period_end: "2026-02-31" }, { forecast_period_start: "bad" }, { reported_forecast_dps: -1 }, { reported_forecast_dividend_gross: 2001 },
    { reported_forecast_dividend_gross: " " }, { annual_projection_exclusion_reason: "share_basis_missing" },
  ])("不正/未証明の対象期を確認済み公表額へ通さない: %j", extra => {
    const p = source(extra); expect(reportedPeriodDividend(p, p.positions[0])).toBeNull(); expect(dividendDisplay(p).excludedCount).toBe(0);
  });
  it("原本整合証明のない値を表示しない。旧DBの追加列なしでも年間契約は維持", () => {
    const p = source(); p.sourceIntegrity = false;
    expect(reportedPeriodDividend(p, p.positions[0])).toBeNull();
    const legacy = source({ forecast_period_start: undefined, forecast_period_end: undefined, forecast_period_months: undefined, reported_forecast_dps: undefined, reported_forecast_dividend_gross: undefined, annual_projection_exclusion_reason: undefined, dividend_comparison_exclusion_reason: undefined });
    expect(legacy.status).toBe("incomplete"); expect(legacy.projectedAnnualGross).toBeNull();
    expect(dividendDisplay(legacy).unverifiedCount).toBe(1);
  });
  it("除外理由とannual値が矛盾しても年間・比較の数字へ戻さない", () => {
    const p = source({ cash_projection_status: "resolved", forecast_dps: 20, projected_annual_dividend_gross: 2000, dividend_change_type: "increase", dividend_rate_effect_gross: 1000, prior_actual_run_rate_gross: 1000 });
    expect(p.positions[0]).toMatchObject({ annualGross: null, forecastDps: null, rateEffectGross: null, priorRunRateGross: null, changeType: "not_comparable" });
    expect(p.projectedAnnualGross).toBeNull();
  });
  it("各比較不可理由を説明し、未知の理由でも成功表示にしない", () => {
    expect(dividendExclusionLabel("actual_semantics_missing")).toContain("比較元");
    expect(dividendExclusionLabel("non_consecutive_fiscal_period")).toContain("連続");
    expect(dividendExclusionLabel("unknown")).toBe("比較条件が未確認");
  });
});
