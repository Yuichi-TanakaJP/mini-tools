import type { DomesticDividendProjection } from "./dividend-income";

/** Display only verified annual amounts; a partial sum never certifies the full total. */
export function dividendDisplay(projection: DomesticDividendProjection | undefined) {
  const usable = projection?.sourceIntegrity === true && ["ready", "incomplete"].includes(projection.status);
  const at = Date.parse(projection?.asOf ?? "");
  const confirmed = usable ? projection.positions.filter((row) => row.cashProjectionStatus === "resolved"
    && row.annualGross !== null && Number.isFinite(row.annualGross) && row.annualGross >= 0
    && row.forecastDps !== null && Number.isFinite(row.forecastDps) && row.forecastDps >= 0
    && row.quantity !== null && Number.isFinite(row.quantity) && row.quantity >= 0
    && row.forecastAsOf !== null && Number.isFinite(Date.parse(row.forecastAsOf)) && Date.parse(row.forecastAsOf) <= at) : [];
  const confirmedGross = confirmed.length > 0 ? confirmed.reduce((sum, row) => sum + row.annualGross!, 0) : null;
  const completeTotal = usable && projection.status === "ready" && projection.projectedAnnualGross !== null
    && Number.isFinite(projection.projectedAnnualGross) && projection.projectedAnnualGross >= 0
    && confirmed.length === projection.expectedStocks && new Set(confirmed.map((row) => row.instrumentId)).size === confirmed.length
    && confirmedGross !== null && Math.abs(confirmedGross - projection.projectedAnnualGross) <= 0.01 ? projection.projectedAnnualGross : null;
  return { confirmedGross, completeTotal, confirmedCount: confirmed.length, missingCount: Math.max(0, (projection?.expectedStocks ?? 0) - confirmed.length) };
}
