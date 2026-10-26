export type YutaiStockPriceQuote = {
  code: string;
  priceYen: number;
  priceDate: string;
  fetchedAt: string;
};

export type YutaiStockPriceSnapshot = {
  generatedAt: string;
  scopeMonth: string;
  provider: string;
  recordCount: number;
  successCount: number;
  quotes: YutaiStockPriceQuote[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parseYutaiStockPriceSnapshot(
  value: unknown,
  expected?: { scopeMonth: string; now: Date },
): YutaiStockPriceSnapshot | null {
  if (!isRecord(value) || value.schema_version !== 1 || !Array.isArray(value.records)) return null;
  if (
    typeof value.generated_at !== "string" ||
    typeof value.scope_month !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.record_count !== "number" ||
    typeof value.success_count !== "number"
  ) {
    return null;
  }
  if (expected && value.scope_month !== expected.scopeMonth) return null;

  const quotes: YutaiStockPriceQuote[] = [];
  for (const record of value.records) {
    if (
      !isRecord(record) ||
      record.status !== "ok" ||
      typeof record.code !== "string" ||
      !record.code ||
      !isPositiveFiniteNumber(record.price) ||
      typeof record.price_date !== "string" ||
      typeof record.fetched_at !== "string"
    ) {
      continue;
    }
    if (expected) {
      const priceTime = Date.parse(`${record.price_date}T00:00:00+09:00`);
      const fetchedTime = Date.parse(record.fetched_at);
      // The existing 30-code rotation can take a calendar month. Allow 35 days,
      // while excluding invalid, future, and older successful observations.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.price_date)
        || !Number.isFinite(priceTime) || !Number.isFinite(fetchedTime)
        || new Date(priceTime + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) !== record.price_date
        || priceTime > expected.now.getTime() || fetchedTime > expected.now.getTime()
        || expected.now.getTime() - priceTime > 35 * 24 * 60 * 60 * 1000) continue;
    }
    quotes.push({
      code: record.code,
      priceYen: record.price,
      priceDate: record.price_date,
      fetchedAt: record.fetched_at,
    });
  }

  return {
    generatedAt: value.generated_at,
    scopeMonth: value.scope_month,
    provider: value.provider,
    recordCount: value.record_count,
    successCount: value.success_count,
    quotes,
  };
}

export function buildStockPriceByCode(snapshot: YutaiStockPriceSnapshot | null) {
  return new Map(snapshot?.quotes.map((quote) => [quote.code, quote]) ?? []);
}
