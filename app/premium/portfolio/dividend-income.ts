/**
 * Read-only domestic-stock dividend projection derived from the existing
 * Stock Notes owner-scoped view. ETF/MMF income and actual cash receipts
 * are deliberately outside this phase (Mini Tools issue 584 / A3 Q2).
 */
export type DividendProjectionRow = {
  snapshot_id: string;
  snapshot_as_of: string;
  instrument_id: string;
  ticker: string | null;
  instrument_name: string | null;
  quantity: number | string | null;
  latest_actual_dps: number | string | null;
  forecast_dps: number | string | null;
  raw_forecast_dps: number | string | null;
  cash_projection_status: string | null;
  forecast_metric_basis_id: string | null;
  forecast_fact_basis_id: string | null;
  forecast_as_of: string | null;
  forecast_period_start?: string | null;
  forecast_period_end?: string | null;
  forecast_period_months?: number | string | null;
  reported_forecast_dps?: number | string | null;
  reported_forecast_dividend_gross?: number | string | null;
  annual_projection_exclusion_reason?: string | null;
  dividend_comparison_exclusion_reason?: string | null;
  projected_annual_dividend_gross: number | string | null;
  prior_actual_run_rate_gross: number | string | null;
  dividend_rate_effect_gross: number | string | null;
  dividend_change_type: string | null;
};

export type DividendTotalsRow = {
  snapshot_id: string;
  snapshot_as_of: string;
  holding_count: number | string | null;
  confirmed_count: number | string | null;
  held_count: number | string | null;
  confirmed_partial_total: number | string | null;
  projected_annual_dividend_gross: number | string | null;
  status: string | null;
};

export type DomesticDividendPosition = {
  instrumentId: string;
  ticker: string | null;
  name: string | null;
  quantity: number | null;
  actualDps: number | null;
  forecastDps: number | null;
  rawForecastDps: number | null;
  cashProjectionStatus: string | null;
  forecastAsOf: string | null;
  forecastPeriodStart?: string | null;
  forecastPeriodEnd?: string | null;
  forecastPeriodMonths?: number | null;
  reportedForecastDps?: number | null;
  reportedForecastGross?: number | null;
  annualExclusionReason?: string | null;
  comparisonExclusionReason?: string | null;
  annualGross: number | null;
  priorRunRateGross: number | null;
  rateEffectGross: number | null;
  changeType: string | null;
};

export type DomesticDividendProjection = {
  sourceIntegrity?: boolean;
  status: "no_snapshot" | "no_domestic_stocks" | "error" | "incomplete" | "ready";
  asOf: string | null;
  latestForecastAsOf: string | null;
  expectedStocks: number;
  coveredStocks: number;
  projectedAnnualGross: number | null;
  priorRunRateGross: number | null;
  comparableRateEffectGross: number | null;
  comparableCount: number;
  increaseCount: number;
  decreaseCount: number;
  unchangedCount: number;
  notComparableCount: number;
  positions: DomesticDividendPosition[];
};

function amount(value: number | string | null): number | null {
  if (value === null || (typeof value === "string" && value.trim() === "")) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function emptyDomesticDividendProjection(
  status: DomesticDividendProjection["status"],
  asOf: string | null = null,
): DomesticDividendProjection {
  return {
    status,
    sourceIntegrity: false,
    asOf,
    latestForecastAsOf: null,
    expectedStocks: 0,
    coveredStocks: 0,
    projectedAnnualGross: null,
    priorRunRateGross: null,
    comparableRateEffectGross: null,
    comparableCount: 0,
    increaseCount: 0,
    decreaseCount: 0,
    unchangedCount: 0,
    notComparableCount: 0,
    positions: [],
  };
}

/**
 * Never present a sum of partial source rows as the portfolio-wide total.
 * A previous-actual DPS is not the user's historical cash receipt.
 */
export function summarizeDomesticDividendProjection(
  rows: DividendProjectionRow[],
  snapshot: { id: string; asOf: string },
  domesticInstrumentIds: readonly string[],
  totals: DividendTotalsRow | null = null,
): DomesticDividendProjection {
  const expected = new Set(domesticInstrumentIds);
  if (expected.size === 0) {
    return { ...emptyDomesticDividendProjection("no_domestic_stocks", snapshot.asOf) };
  }

  const positions: DomesticDividendPosition[] = rows.map((row) => ({
    instrumentId: row.instrument_id,
    ticker: row.ticker,
    name: row.instrument_name,
    quantity: amount(row.quantity),
    actualDps: amount(row.latest_actual_dps),
    forecastDps: row.cash_projection_status === "resolved" && !row.annual_projection_exclusion_reason ? amount(row.forecast_dps) : null,
    rawForecastDps: amount(row.raw_forecast_dps),
    cashProjectionStatus: row.cash_projection_status ?? null,
    forecastAsOf: row.forecast_as_of,
    forecastPeriodStart: row.forecast_period_start ?? null,
    forecastPeriodEnd: row.forecast_period_end ?? null,
    forecastPeriodMonths: amount(row.forecast_period_months ?? null),
    reportedForecastDps: amount(row.reported_forecast_dps ?? null),
    reportedForecastGross: amount(row.reported_forecast_dividend_gross ?? null),
    annualExclusionReason: row.annual_projection_exclusion_reason ?? null,
    comparisonExclusionReason: row.dividend_comparison_exclusion_reason ?? null,
    annualGross: row.cash_projection_status === "resolved" && !row.annual_projection_exclusion_reason ? amount(row.projected_annual_dividend_gross) : null,
    priorRunRateGross: row.dividend_comparison_exclusion_reason ? null : amount(row.prior_actual_run_rate_gross),
    rateEffectGross: row.cash_projection_status === "resolved" && !row.annual_projection_exclusion_reason && !row.dividend_comparison_exclusion_reason ? amount(row.dividend_rate_effect_gross) : null,
    changeType: row.dividend_comparison_exclusion_reason || row.annual_projection_exclusion_reason ? "not_comparable" : row.dividend_change_type,
  }));

  const sourceIds = rows.map((row) => row.instrument_id);
  const completeCoverage = rows.length === expected.size
    && new Set(sourceIds).size === expected.size
    && sourceIds.every((id) => expected.has(id));
  const snapshotAt = Date.parse(snapshot.asOf);
  const consistentSnapshot = Number.isFinite(snapshotAt)
    && rows.every((row) => row.snapshot_id === snapshot.id
      && Date.parse(row.snapshot_as_of) === snapshotAt);
  const allAnnualAmountsKnown = positions.every((row) =>
    row.annualGross !== null && row.forecastDps !== null && row.quantity !== null);
  // The selected view uses timestamps for forecasts; a missing date means
  // the projection cannot be certified fresh, even if an amount is present.
  const hasAllSourceDates = positions.every((row) => row.forecastAsOf
    && Number.isFinite(Date.parse(row.forecastAsOf))
    && Date.parse(row.forecastAsOf) <= snapshotAt);
  const completeTotal = amount(totals?.projected_annual_dividend_gross ?? null);
  const validTotals = totals?.status === "resolved"
    && totals.snapshot_id === snapshot.id
    && Date.parse(totals.snapshot_as_of) === snapshotAt
    && amount(totals.holding_count) === expected.size
    && amount(totals.confirmed_count) === expected.size
    && amount(totals.held_count) === 0
    && completeTotal !== null;
  const knownAmounts = positions.filter((row) => row.annualGross !== null);
  const sumKnown = knownAmounts.reduce((sum, row) => sum + row.annualGross!, 0);
  const partial = amount(totals?.confirmed_partial_total ?? null);
  const partialMatches = knownAmounts.length === 0
    ? partial === null || partial === 0
    : partial !== null && Math.abs(partial - sumKnown) < 0.000001;
  const sourceIntegrity = completeCoverage && consistentSnapshot && Boolean(totals)
    && totals!.snapshot_id === snapshot.id
    && Date.parse(totals!.snapshot_as_of) === snapshotAt
    && amount(totals!.holding_count) === expected.size
    && amount(totals!.confirmed_count) === knownAmounts.length
    && amount(totals!.held_count) === expected.size - knownAmounts.length
    && partialMatches
    && ((totals!.status === "resolved" && knownAmounts.length === expected.size && completeTotal !== null)
      || (totals!.status === "review_required" && knownAmounts.length < expected.size && completeTotal === null))
    && (completeTotal === null || Math.abs(completeTotal - sumKnown) < 0.000001);
  const complete = sourceIntegrity && completeCoverage && consistentSnapshot
    && allAnnualAmountsKnown && hasAllSourceDates && validTotals;

  const comparable = positions.filter((row) =>
    ["increase", "decrease", "unchanged"].includes(row.changeType ?? ""));
  const comparableValid = comparable.every((row) => row.rateEffectGross !== null);
  const fullPriorKnown = positions.every((row) => row.priorRunRateGross !== null);

  const sorted = [...positions].sort((a, b) =>
    (b.annualGross ?? -Infinity) - (a.annualGross ?? -Infinity)
      || (a.ticker ?? "").localeCompare(b.ticker ?? ""));

  return {
    status: complete ? "ready" : "incomplete",
    sourceIntegrity,
    asOf: snapshot.asOf,
    latestForecastAsOf: positions.map((row) => row.forecastAsOf)
      .filter((value): value is string => Boolean(value))
      .sort().at(-1) ?? null,
    expectedStocks: expected.size,
    coveredStocks: new Set(sourceIds.filter((id) => expected.has(id))).size,
    projectedAnnualGross: complete
      ? completeTotal
      : null,
    priorRunRateGross: complete && fullPriorKnown
      ? positions.reduce((sum, row) => sum + (row.priorRunRateGross ?? 0), 0)
      : null,
    comparableRateEffectGross: complete && comparable.length > 0 && comparableValid
      ? comparable.reduce((sum, row) => sum + (row.rateEffectGross ?? 0), 0)
      : null,
    comparableCount: comparable.length,
    increaseCount: positions.filter((row) => row.changeType === "increase").length,
    decreaseCount: positions.filter((row) => row.changeType === "decrease").length,
    unchangedCount: positions.filter((row) => row.changeType === "unchanged").length,
    notComparableCount: positions.filter((row) =>
      !["increase", "decrease", "unchanged"].includes(row.changeType ?? "")).length,
    positions: sorted,
  };
}
