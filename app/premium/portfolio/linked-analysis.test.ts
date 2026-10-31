import { describe, expect, it } from "vitest";
import { buildAnalysisGroups, resolveAnalysisSelection, selectDividendProjection } from "./linked-analysis";
import { summarizeDomesticDividendProjection, type DividendProjectionRow, type DividendTotalsRow } from "./dividend-income";
import type { PortfolioPosition } from "./types";
const snapshot = { id: "snapshot", asOf: "2026-10-31T01:00:00Z" };
function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition { return { id: "p1", accountId: "a1", instrumentId: "i1", assetType: "domestic_stock", identifier: "TEST1", name: "合成株", accountName: "口座A", accountType: "taxable", institutionName: "証券", quantity: 100, unitCost: null, quotedPrice: null, quoteUnit: 1, costBasis: null, marketValue: 900, unrealizedPnl: null, distributionMethod: null, ...overrides }; }
const positions = [position(), position({ id: "p2", accountId: "a2", accountName: "口座B", accountType: "nisa_growth", quantity: 300, marketValue: 100 })];
function sourceRow(overrides: Partial<DividendProjectionRow> = {}): DividendProjectionRow { return { snapshot_id: snapshot.id, snapshot_as_of: snapshot.asOf, instrument_id: "i1", ticker: "TEST1", instrument_name: "合成株", quantity: 400, latest_actual_dps: 8, forecast_dps: 10, raw_forecast_dps: 10, cash_projection_status: "resolved", forecast_metric_basis_id: "basis", forecast_fact_basis_id: null, forecast_as_of: "2026-10-01", projected_annual_dividend_gross: 4000, prior_actual_run_rate_gross: 3200, dividend_rate_effect_gross: 800, dividend_change_type: "increase", ...overrides }; }
function totals(overrides: Partial<DividendTotalsRow> = {}): DividendTotalsRow { return { snapshot_id: snapshot.id, snapshot_as_of: snapshot.asOf, holding_count: 1, confirmed_count: 1, held_count: 0, confirmed_partial_total: 4000, projected_annual_dividend_gross: 4000, status: "resolved", ...overrides }; }
const source = summarizeDomesticDividendProjection([sourceRow()], snapshot, ["i1"], totals());

describe("選択範囲の保有・配当連動", () => {
  it("口座を分けてから数量で配当按分し、評価額比では配分しない", () => {
    const groups = buildAnalysisGroups(positions, [], "account_type", "all");
    const first = selectDividendProjection(source, positions, groups.visible[0].positions)!;
    const second = selectDividendProjection(source, positions, groups.visible[1].positions)!;
    expect(first.status).toBe("ready");
    expect(first.projectedAnnualGross).toBe(1000);
    expect(first.priorRunRateGross).toBe(800);
    expect(first.comparableRateEffectGross).toBe(200);
    expect(first.positions[0].quantity).toBe(100);
    expect(first.projectedAnnualGross! + second.projectedAnnualGross!).toBe(4000);
    expect(selectDividendProjection(source, positions, positions)?.projectedAnnualGross).toBe(source.projectedAnnualGross);
  });
  it("選択外の未確認を全体額へ補完せず、完全な選択範囲だけ確定できる", () => {
    const held = sourceRow({ instrument_id: "i2", quantity: 50, cash_projection_status: "share_basis_missing", projected_annual_dividend_gross: null, forecast_dps: null });
    const global = summarizeDomesticDividendProjection([sourceRow(), held], snapshot, ["i1", "i2"], totals({ holding_count: 2, confirmed_count: 1, held_count: 1, projected_annual_dividend_gross: null, status: "review_required" }));
    const all = [...positions, position({ id: "p3", instrumentId: "i2", quantity: 50 })];
    expect(global.status).toBe("incomplete");
    expect(global.sourceIntegrity).toBe(true);
    expect(selectDividendProjection(global, all, positions)?.projectedAnnualGross).toBe(4000);
    expect(selectDividendProjection(global, all, all)?.projectedAnnualGross).toBeNull();
  });
  it.each([NaN, Infinity, -1, 0, 399, null])("元数量が%sの場合は比較・年額を保留する", (quantity) => {
    const mismatch = { ...source, positions: [{ ...source.positions[0], quantity }] };
    const result = selectDividendProjection(mismatch, positions, [positions[0]])!;
    expect(result.projectedAnnualGross).toBeNull();
    expect(result.positions[0].annualGross).toBeNull();
    expect(result.positions[0].rateEffectGross).toBeNull();
  });
  it.each([NaN, Infinity, -1])("選択数量が%sの場合も保留する", (quantity) => {
    expect(selectDividendProjection(source, positions, [position({ quantity })])?.projectedAnnualGross).toBeNull();
  });
  it("snapshot/金額/重複行の不整合ではsubsetも保留する", () => {
    for (const bad of [
      summarizeDomesticDividendProjection([sourceRow({ snapshot_id: "old" })], snapshot, ["i1"], totals()),
      summarizeDomesticDividendProjection([sourceRow()], snapshot, ["i1"], totals({ confirmed_partial_total: 4100 })),
      summarizeDomesticDividendProjection([sourceRow(), sourceRow()], snapshot, ["i1"], totals()),
    ]) expect(selectDividendProjection(bad, positions, [positions[0]])?.projectedAnnualGross).toBeNull();
  });
  it("国内株なしは0円とせず対象なしを返す", () => {
    const fund = position({ instrumentId: "fund", assetType: "investment_fund" });
    expect(selectDividendProjection(source, [...positions, fund], [fund])).toMatchObject({ status: "no_domestic_stocks", projectedAnnualGross: null });
  });
  it("未評価保有を残し、その他実分類・集約その他・未分類を混同しない", () => {
    const all = Array.from({ length: 12 }, (_, i) => position({ id: `p${i}`, instrumentId: `i${i}`, assetType: i === 0 ? "other" : `type${i}`, marketValue: i === 11 ? null : 100 + i }));
    const groups = buildAnalysisGroups(all, [], "asset_type", "all");
    expect(groups.all).toHaveLength(12);
    expect(groups.all.find((g) => g.key === "bucket:other")).toBeDefined();
    expect(groups.visible.find((g) => g.key === "aggregate:other")).toBeDefined();
    expect(groups.visible.flatMap((g) => g.positions)).toHaveLength(12);
    expect(new Set(groups.visible.flatMap((g) => g.positions.map((p) => p.id))).size).toBe(12);
    expect(groups.visible.reduce((sum, g) => sum + g.percentage, 0)).toBeCloseTo(100);
    expect(groups.visible.reduce((sum, g) => sum + g.missingValueCount, 0)).toBe(1);
    const unclassified = buildAnalysisGroups(all, [], "sector_33", "all");
    expect(unclassified.visible[0].isUnclassified).toBe(true);
    expect(unclassified.visible[0].positions).toHaveLength(12);
  });
});

it("上位外の分類も直接選び、残余・未分類と合わせて分母を維持する", () => {
  const positions = Array.from({ length: 13 }, (_, i) => position({ id: `p${i}`, instrumentId: `i${i}`, marketValue: 100 + i }));
  const analysis = positions.slice(0, 12).map((p, i) => ({ instrumentId: p.instrumentId, stockId: null, sector33Code: `s${i}`, sector33Name: `業種${i}`, cycleProfile: null, incomeProfile: null, marketCapProfile: null }));
  const model = buildAnalysisGroups(positions, analysis, "sector_33", "all");
  const hidden = model.all.find((g) => !g.isUnclassified && !model.visible.some((v) => v.key === g.key))!;
  const chosen = resolveAnalysisSelection(model, hidden.key);
  expect(chosen.selected?.key).toBe(hidden.key);
  expect(chosen.chartGroups.map((g) => g.key)).toEqual([hidden.key, "action:clear", "bucket:unclassified"]);
  expect(chosen.chartGroups.reduce((sum, group) => sum + group.percentage, 0)).toBeCloseTo(100);
  expect(new Set(chosen.chartGroups.flatMap((g) => g.positions.map((p) => p.id))).size).toBe(13);
});

it.each([" ", "\t", "\n"])("空白数値%sを、選択範囲の確定0円へ変換しない", (blank) => {
  const bad = summarizeDomesticDividendProjection([sourceRow({ forecast_dps: blank, projected_annual_dividend_gross: blank })], snapshot, ["i1"], totals({ confirmed_partial_total: blank, projected_annual_dividend_gross: blank }));
  expect(bad.sourceIntegrity).toBe(false);
  expect(selectDividendProjection(bad, positions, [positions[0]])?.projectedAnnualGross).toBeNull();
});

it("全数量0と、公表日が保有基準日より未来の選択は保留する", () => {
  const zeroPositions = positions.map((p) => ({ ...p, quantity: 0 }));
  expect(selectDividendProjection({ ...source, positions: [{ ...source.positions[0], quantity: 0 }] }, zeroPositions, zeroPositions)?.projectedAnnualGross).toBeNull();
  const future = summarizeDomesticDividendProjection([sourceRow({ forecast_as_of: "2026-11-01" })], snapshot, ["i1"], totals());
  expect(selectDividendProjection(future, positions, positions)?.projectedAnnualGross).toBeNull();
});

it("確認済み無配の選択範囲は0円を正しく保持する", () => {
  const zero = summarizeDomesticDividendProjection([sourceRow({ forecast_dps: 0, projected_annual_dividend_gross: 0, dividend_rate_effect_gross: -3200, dividend_change_type: "decrease" })], snapshot, ["i1"], totals({ confirmed_partial_total: 0, projected_annual_dividend_gross: 0 }));
  expect(selectDividendProjection(zero, positions, [positions[0]])).toMatchObject({ status: "ready", projectedAnnualGross: 0, comparableRateEffectGross: -800 });
});

it("年額が確認済みでも比較可能な銘柄が0件なら寄与を0円にしない", () => {
  const noComparison = summarizeDomesticDividendProjection([sourceRow({ prior_actual_run_rate_gross: null, dividend_rate_effect_gross: null, dividend_change_type: "not_comparable" })], snapshot, ["i1"], totals());
  expect(noComparison.status).toBe("ready");
  expect(noComparison.comparableRateEffectGross).toBeNull();
  expect(selectDividendProjection(noComparison, positions, [positions[0]])).toMatchObject({ status: "ready", projectedAnnualGross: 1000, comparableCount: 0, comparableRateEffectGross: null });
});
