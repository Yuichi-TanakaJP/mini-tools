export type MarketObservation = {
  snapshot_id: string; source: string; market_date: string | null;
  date_basis: "explicit_source" | "unknown"; source_observed_at: string | null;
  collected_at: string | null; generated_at: string; input_sha256: string;
};

export function parseMarketObservation(value: unknown): MarketObservation | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Partial<MarketObservation>;
  const validSourceTime = (s: unknown) => s === null || (typeof s === "string" &&
    (/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s) ||
    (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s)))));
  const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (typeof o.snapshot_id !== "string" || !/^[a-f0-9]{32}$/.test(o.snapshot_id) || typeof o.source !== "string" ||
      typeof o.input_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(o.input_sha256) ||
      typeof o.generated_at !== "string" || !Number.isFinite(Date.parse(o.generated_at)) ||
      !(o.collected_at === null || (typeof o.collected_at === "string" && Number.isFinite(Date.parse(o.collected_at)))) ||
      !validSourceTime(o.source_observed_at)) return null;
  if (o.date_basis === "unknown" && o.market_date === null) return o as MarketObservation;
  if (o.date_basis === "explicit_source" && validDate(o.market_date)) return o as MarketObservation;
  return null;
}

export function confirmedMarketDate(value: unknown): string | null {
  const observation = parseMarketObservation(value);
  return observation?.date_basis === "explicit_source" ? observation.market_date : null;
}
