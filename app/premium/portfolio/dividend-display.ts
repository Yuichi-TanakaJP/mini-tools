import type { DomesticDividendPosition, DomesticDividendProjection } from "./dividend-income";

/** Display only verified annual amounts; a partial sum never certifies the full total. */
export function dividendDisplay(projection: DomesticDividendProjection | undefined) {
  const usable = projection?.sourceIntegrity === true && ["ready", "incomplete"].includes(projection.status);
  const at = Date.parse(projection?.asOf ?? "");
  const confirmed = usable ? projection.positions.filter((row) => row.cashProjectionStatus === "resolved" && !row.annualExclusionReason
    && row.annualGross !== null && Number.isFinite(row.annualGross) && row.annualGross >= 0
    && row.forecastDps !== null && Number.isFinite(row.forecastDps) && row.forecastDps >= 0
    && row.quantity !== null && Number.isFinite(row.quantity) && row.quantity >= 0
    && row.forecastAsOf !== null && Number.isFinite(Date.parse(row.forecastAsOf)) && Date.parse(row.forecastAsOf) <= at) : [];
  const confirmedGross = confirmed.length > 0 ? confirmed.reduce((sum, row) => sum + row.annualGross!, 0) : null;
  const completeTotal = usable && projection.status === "ready" && projection.projectedAnnualGross !== null
    && Number.isFinite(projection.projectedAnnualGross) && projection.projectedAnnualGross >= 0
    && confirmed.length === projection.expectedStocks && new Set(confirmed.map((row) => row.instrumentId)).size === confirmed.length
    && confirmedGross !== null && Math.abs(confirmedGross - projection.projectedAnnualGross) <= 0.01 ? projection.projectedAnnualGross : null;
  const excludedCount = usable ? projection.positions.filter((row) => reportedPeriodDividend(projection, row) !== null).length : 0;
  const missingCount = Math.max(0, (projection?.expectedStocks ?? 0) - confirmed.length);
  return { confirmedGross, completeTotal, confirmedCount: confirmed.length, missingCount, excludedCount, unverifiedCount: Math.max(0, missingCount - excludedCount) };
}


/** A verified short-period disclosure is separate from a twelve-month projection. */
export function reportedPeriodDividend(projection: DomesticDividendProjection | undefined, row: DomesticDividendPosition) {
  const at = Date.parse(projection?.asOf ?? "");
  const published = Date.parse(row.forecastAsOf ?? "");
  const start = Date.parse(row.forecastPeriodStart ?? "");
  const end = Date.parse(row.forecastPeriodEnd ?? "");
  const months = row.forecastPeriodMonths;
  const dps = row.reportedForecastDps;
  const gross = row.reportedForecastGross;
  if (projection?.sourceIntegrity !== true || !["ready", "incomplete"].includes(projection.status)
    || row.annualExclusionReason !== "non_annual_period" || row.annualGross !== null
    || months == null || !Number.isInteger(months) || months < 1 || months >= 12
    || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || !Number.isFinite(published) || !Number.isFinite(at) || published > at
    || row.quantity === null || !Number.isFinite(row.quantity) || row.quantity < 0
    || dps == null || !Number.isFinite(dps) || dps < 0 || gross == null || !Number.isFinite(gross) || gross < 0
    || Math.abs(gross - row.quantity * dps) > 0.01) return null;
  const startDate = new Date(start);
  const expectedEnd = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + months, 1) - 86400000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.forecastPeriodStart!) || !/^\d{4}-\d{2}-\d{2}$/.test(row.forecastPeriodEnd!)
    || startDate.getUTCDate() !== 1 || new Date(start).toISOString().slice(0, 10) !== row.forecastPeriodStart || expectedEnd !== end) return null;
  return { dps, gross, months, start: row.forecastPeriodStart!, end: row.forecastPeriodEnd! };
}

export function dividendExclusionLabel(reason: string | null | undefined): string {
  const labels: Record<string, string> = {
    non_annual_period: "12か月ではない対象期のため、年間集計・前年比から除外",
    conditional_forecast: "条件付き予想のため年間集計から除外",
    dividend_semantics_unresolved: "配当の対象期間・内訳が未確認",
    share_basis_missing: "株数基準が未確認",
    actual_conditional: "比較元の実績に条件付き項目あり",
    actual_semantics_missing: "比較元の実績の対象期間・内訳が未確認",
    non_consecutive_fiscal_period: "連続する同じ長さの年度ではないため比較不可",
    share_basis_unresolved: "比較する配当の株数基準が未確認",
    recurring_semantics_unresolved: "普通配当・特別配当の比較条件が未確認",
  };
  return labels[reason ?? ""] ?? "比較条件が未確認";
}

export function dividendCoverageNote(display: ReturnType<typeof dividendDisplay>) {
  return [display.excludedCount > 0 ? `年間集計対象外 ${display.excludedCount}銘柄` : "", display.unverifiedCount > 0 ? `未確認 ${display.unverifiedCount}銘柄` : ""].filter(Boolean).join(" ／ ");
}
