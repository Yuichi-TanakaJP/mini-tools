import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PortfolioDividend from "./PortfolioDividend";
import { describe, expect, it } from "vitest";
import {
  emptyDomesticDividendProjection,
  summarizeDomesticDividendProjection,
  type DividendProjectionRow,
  type DividendTotalsRow,
} from "./dividend-income";

const snapshot = { id: "s1", asOf: "2026-09-21T04:08:00Z" };

function row(overrides: Partial<DividendProjectionRow> = {}): DividendProjectionRow {
  return {
    snapshot_id: snapshot.id,
    snapshot_as_of: snapshot.asOf,
    instrument_id: "i1",
    ticker: "1111",
    instrument_name: "試験株",
    quantity: "100",
    latest_actual_dps: "50",
    forecast_dps: "60",
    raw_forecast_dps: "60",
    cash_projection_status: "resolved",
    forecast_metric_basis_id: "basis-1",
    forecast_fact_basis_id: null,
    forecast_as_of: "2026-09-15T00:00:00Z",
    projected_annual_dividend_gross: "6000",
    prior_actual_run_rate_gross: "5000",
    dividend_rate_effect_gross: "1000",
    dividend_change_type: "increase",
    ...overrides,
  };
}

function totals(overrides: Partial<DividendTotalsRow> = {}): DividendTotalsRow {
  return { snapshot_id: snapshot.id, snapshot_as_of: snapshot.asOf,
    holding_count: 1, confirmed_count: 1, held_count: 0,
    confirmed_partial_total: "6000", projected_annual_dividend_gross: "6000",
    status: "resolved", ...overrides };
}

describe("国内株の配当予想（Stock Notes正本View）", () => {
  it("数値文字列を集計し、基準日と対象銘柄を限定する", () => {
    const summary = summarizeDomesticDividendProjection([row()], snapshot, ["i1"], totals());
    expect(summary).toMatchObject({
      status: "ready", expectedStocks: 1, coveredStocks: 1,
      projectedAnnualGross: 6000, priorRunRateGross: 5000,
      comparableRateEffectGross: 1000, increaseCount: 1,
    });
    expect(summary.positions[0].actualDps).toBe(50);
  });

  it("比較不能な銘柄は実績ベースの全体額に足さず、単価寄与を比較可能分だけ表示する", () => {
    const summary = summarizeDomesticDividendProjection([
      row(),
      row({ instrument_id: "i2", ticker: "2222", projected_annual_dividend_gross: "0",
        prior_actual_run_rate_gross: null, dividend_rate_effect_gross: null,
        dividend_change_type: "not_comparable", forecast_dps: "0" }),
    ], snapshot, ["i1", "i2"], totals({ holding_count: 2, confirmed_count: 2 }));
    expect(summary).toMatchObject({
      status: "ready", projectedAnnualGross: 6000, priorRunRateGross: null,
      comparableRateEffectGross: 1000, comparableCount: 1, notComparableCount: 1,
    });
    expect(summary.positions[1].annualGross).toBe(0); // real zero != unknown
  });

  it("未取得1件を全体額に見せかけない", () => {
    const summary = summarizeDomesticDividendProjection([row()], snapshot, ["i1", "i2"], totals({ holding_count: 2, confirmed_count: 2 }));
    expect(summary).toMatchObject({
      status: "incomplete", expectedStocks: 2, coveredStocks: 1,
      projectedAnnualGross: null, comparableRateEffectGross: null,
    });
  });

  it("同一銘柄の二重行を全体予想に重複計上しない", () => {
    const summary = summarizeDomesticDividendProjection([row(), row()], snapshot, ["i1"], totals());
    expect(summary.status).toBe("incomplete");
    expect(summary.projectedAnnualGross).toBeNull();
  });

  it("別snapshot由来の金額を混在させない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ snapshot_id: "old" }),
    ], snapshot, ["i1"], totals());
    expect(summary.status).toBe("incomplete");
  });

  it("予想金額欠損を0円扱いしない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ projected_annual_dividend_gross: null }),
    ], snapshot, ["i1"], totals());
    expect(summary.status).toBe("incomplete");
    expect(summary.projectedAnnualGross).toBeNull();
  });

  it("保有基準日より後に公表された配当予想を過去の保有に採用しない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ forecast_as_of: "2026-09-25T00:00:00Z" }),
    ], snapshot, ["i1"], totals());
    expect(summary.status).toBe("incomplete");
  });

  it("未ログイン・取込失敗・保有なしの状態を0円に偽装しない", () => {
    expect(emptyDomesticDividendProjection("no_snapshot").projectedAnnualGross).toBeNull();
    expect(emptyDomesticDividendProjection("error", snapshot.asOf).status).toBe("error");
    expect(summarizeDomesticDividendProjection([], snapshot, []).status).toBe("no_domestic_stocks");
  });
});

it("DB totalsと行金額が不整合なら部分和にも正本額にも置換せず保留する", () => {
  const result = summarizeDomesticDividendProjection([row()], snapshot, ["i1"],
    totals({ projected_annual_dividend_gross: "6100" }));
  expect(result.projectedAnnualGross).toBeNull();
  expect(result.sourceIntegrity).toBe(false);
});
it.each([
  null,
  totals({ status: "review_required", held_count: 1, confirmed_count: 0,
    confirmed_partial_total: "6000", projected_annual_dividend_gross: null }),
  totals({ held_count: 1 }),
  totals({ snapshot_id: "other" }),
  totals({ holding_count: 2 }),
  totals({ projected_annual_dividend_gross: null }),
])("totals欠損・不完全・別snapshotを部分和に置換しない", (total) => {
  const result = summarizeDomesticDividendProjection([row()], snapshot, ["i1"], total);
  expect(result.status).toBe("incomplete");
  expect(result.projectedAnnualGross).toBeNull();
});

it("raw DPSが存在してもcash基準未解決を0円や旧予想へfallbackしない", () => {
  const result = summarizeDomesticDividendProjection([
    row({ cash_projection_status: "basis_missing", raw_forecast_dps: "60" }),
  ], snapshot, ["i1"], totals());
  expect(result.status).toBe("incomplete");
  expect(result.projectedAnnualGross).toBeNull();
  expect(result.positions[0]).toMatchObject({ annualGross: null, forecastDps: null,
    rawForecastDps: 60, cashProjectionStatus: "basis_missing" });
});

it("無配の確認済み0円は未確認と区別する", () => {
  const result = summarizeDomesticDividendProjection([
    row({ forecast_dps: "0", projected_annual_dividend_gross: "0" }),
  ], snapshot, ["i1"], totals({ projected_annual_dividend_gross: "0", confirmed_partial_total: "0" }));
  expect(result.status).toBe("ready");
  expect(result.projectedAnnualGross).toBe(0);
});

it("画面で未確認のraw DPS・部分和を完全合計や行金額へ戻さない", () => {
  const projection = summarizeDomesticDividendProjection([
    row({ cash_projection_status: "basis_missing" }),
  ], snapshot, ["i1"], totals({ status: "review_required", held_count: 1,
    confirmed_count: 0, projected_annual_dividend_gross: null }));
  const html = renderToStaticMarkup(createElement(PortfolioDividend, { projection }));
  expect(html).toContain("基準未確認");
  expect(html).toContain("明細取得 1/1銘柄");
  expect(html).toContain("株数基準確認済み 0/1銘柄");
  expect(html).toContain("年間合計は未確定");
  expect(html).not.toContain("￥6,000");
  expect(html).not.toContain("￥60");
});

it("画面で明細取得件数と株数基準確認済み件数を区別する", () => {
  const projection = summarizeDomesticDividendProjection([
    row(),
    row({ instrument_id: "i2", cash_projection_status: "basis_missing" }),
    row({ instrument_id: "i3", projected_annual_dividend_gross: null }),
    row({ instrument_id: "i4", forecast_dps: "0", projected_annual_dividend_gross: "0" }),
  ], snapshot, ["i1", "i2", "i3", "i4"], null);
  const html = renderToStaticMarkup(createElement(PortfolioDividend, { projection }));
  expect(html).toContain("明細取得 4/4銘柄");
  expect(html).toContain("株数基準確認済み 2/4銘柄");
  expect(projection.projectedAnnualGross).toBeNull();
});
