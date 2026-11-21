import { isUsableForecastDate, type DomesticDividendPosition, type DomesticDividendProjection } from "./dividend-income";

/** Display only verified annual amounts; a partial sum never certifies the full total. */
export function dividendDisplay(projection: DomesticDividendProjection | undefined) {
  const usable = projection?.sourceIntegrity === true && ["ready", "incomplete"].includes(projection.status);
  const at = Date.parse(projection?.asOf ?? "");
  const confirmed = usable ? projection.positions.filter((row) => row.cashProjectionStatus === "resolved" && !row.annualExclusionReason
    && row.annualGross !== null && Number.isFinite(row.annualGross) && row.annualGross >= 0
    && row.forecastDps !== null && Number.isFinite(row.forecastDps) && row.forecastDps >= 0
    && row.quantity !== null && Number.isFinite(row.quantity) && row.quantity >= 0
    && isUsableForecastDate(row, at, projection.basis)) : [];
  const confirmedGross = confirmed.length > 0 ? confirmed.reduce((sum, row) => sum + row.annualGross!, 0) : null;
  const completeTotal = usable && projection.status === "ready" && projection.projectedAnnualGross !== null
    && Number.isFinite(projection.projectedAnnualGross) && projection.projectedAnnualGross >= 0
    && confirmed.length === projection.expectedStocks && new Set(confirmed.map((row) => row.instrumentId)).size === confirmed.length
    && confirmedGross !== null && Math.abs(confirmedGross - projection.projectedAnnualGross) <= 0.01 ? projection.projectedAnnualGross : null;
  const excludedCount = usable ? projection.positions.filter((row) => row.annualGross === null && reportedPeriodDividend(projection, row) !== null).length : 0;
  const missingCount = Math.max(0, (projection?.expectedStocks ?? 0) - confirmed.length);
  return { confirmedGross, completeTotal, confirmedCount: confirmed.length, missingCount, excludedCount, unverifiedCount: Math.max(0, missingCount - excludedCount) };
}


/** A verified short-period disclosure is separate from a twelve-month projection. */
export function reportedPeriodDividend(projection: DomesticDividendProjection | undefined, row: DomesticDividendPosition) {
  const at = Date.parse(projection?.asOf ?? "");
  const start = Date.parse(row.forecastPeriodStart ?? "");
  const end = Date.parse(row.forecastPeriodEnd ?? "");
  const months = row.forecastPeriodMonths;
  const dps = row.reportedForecastDps;
  const gross = row.reportedForecastGross;
  const inReceiptTotal = projection?.basis === "reported_period" && row.cashProjectionStatus === "resolved"
    && row.annualGross !== null && row.annualGross === gross;
  const excludedFromAnnual = projection?.basis !== "reported_period"
    && row.annualExclusionReason === "non_annual_period" && row.annualGross === null;
  if (projection?.sourceIntegrity !== true || !["ready", "incomplete"].includes(projection.status)
    || !(inReceiptTotal || excludedFromAnnual)
    || months == null || !Number.isInteger(months) || months < 1 || months >= 12
    || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || !isUsableForecastDate(row, at, projection.basis)
    || row.quantity === null || !Number.isFinite(row.quantity) || row.quantity < 0
    || dps == null || !Number.isFinite(dps) || dps < 0 || gross == null || !Number.isFinite(gross) || gross < 0
    || Math.abs(gross - row.quantity * dps) > 0.01) return null;
  const startDate = new Date(start);
  const targetMonth = startDate.getUTCMonth() + months;
  const targetMonthDays = new Date(Date.UTC(startDate.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  const targetDay = inReceiptTotal ? Math.min(startDate.getUTCDate(), targetMonthDays) : 1;
  const expectedEnd = Date.UTC(startDate.getUTCFullYear(), targetMonth, targetDay - 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.forecastPeriodStart!) || !/^\d{4}-\d{2}-\d{2}$/.test(row.forecastPeriodEnd!)
    || (!inReceiptTotal && startDate.getUTCDate() !== 1) || startDate.toISOString().slice(0, 10) !== row.forecastPeriodStart || expectedEnd !== end) return null;
  return { dps, gross, months, start: row.forecastPeriodStart!, end: row.forecastPeriodEnd! };
}

export function dividendExclusionLabel(reason: string | null | undefined): string {
  const labels: Record<string, string> = {
    non_annual_period: "12か月ではない対象期のため、前年比を比較できません",
    conditional_forecast: "条件付き予想のため受取見込みに含めていません",
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
