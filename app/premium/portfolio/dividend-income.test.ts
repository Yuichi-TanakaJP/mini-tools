import { describe, expect, it } from "vitest";
import {
  emptyDomesticDividendProjection,
  summarizeDomesticDividendProjection,
  type DividendProjectionRow,
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
    forecast_as_of: "2026-09-15T00:00:00Z",
    projected_annual_dividend_gross: "6000",
    prior_actual_run_rate_gross: "5000",
    dividend_rate_effect_gross: "1000",
    dividend_change_type: "increase",
    ...overrides,
  };
}

describe("国内株の配当予想（Stock Notes正本View）", () => {
  it("数値文字列を集計し、基準日と対象銘柄を限定する", () => {
    const summary = summarizeDomesticDividendProjection([row()], snapshot, ["i1"]);
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
    ], snapshot, ["i1", "i2"]);
    expect(summary).toMatchObject({
      status: "ready", projectedAnnualGross: 6000, priorRunRateGross: null,
      comparableRateEffectGross: 1000, comparableCount: 1, notComparableCount: 1,
    });
    expect(summary.positions[1].annualGross).toBe(0); // real zero != unknown
  });

  it("未取得1件を全体額に見せかけない", () => {
    const summary = summarizeDomesticDividendProjection([row()], snapshot, ["i1", "i2"]);
    expect(summary).toMatchObject({
      status: "incomplete", expectedStocks: 2, coveredStocks: 1,
      projectedAnnualGross: null, comparableRateEffectGross: null,
    });
  });

  it("同一銘柄の二重行を全体予想に重複計上しない", () => {
    const summary = summarizeDomesticDividendProjection([row(), row()], snapshot, ["i1"]);
    expect(summary.status).toBe("incomplete");
    expect(summary.projectedAnnualGross).toBeNull();
  });

  it("別snapshot由来の金額を混在させない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ snapshot_id: "old" }),
    ], snapshot, ["i1"]);
    expect(summary.status).toBe("incomplete");
  });

  it("予想金額欠損を0円扱いしない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ projected_annual_dividend_gross: null }),
    ], snapshot, ["i1"]);
    expect(summary.status).toBe("incomplete");
    expect(summary.projectedAnnualGross).toBeNull();
  });

  it("保有基準日より後に公表された配当予想を過去の保有に採用しない", () => {
    const summary = summarizeDomesticDividendProjection([
      row({ forecast_as_of: "2026-09-25T00:00:00Z" }),
    ], snapshot, ["i1"]);
    expect(summary.status).toBe("incomplete");
  });

  it("未ログイン・取込失敗・保有なしの状態を0円に偽装しない", () => {
    expect(emptyDomesticDividendProjection("no_snapshot").projectedAnnualGross).toBeNull();
    expect(emptyDomesticDividendProjection("error", snapshot.asOf).status).toBe("error");
    expect(summarizeDomesticDividendProjection([], snapshot, []).status).toBe("no_domestic_stocks");
  });
});
