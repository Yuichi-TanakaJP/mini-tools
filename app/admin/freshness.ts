export type Freshness = "fresh" | "recent" | "stale" | "failed" | "none";

/** JST (Asia/Tokyo) 基準で YYYY-MM-DD を返す */
export function jstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getAgeDaysFromDate(value: string, todayJst: string = jstDateString()): number | null {
  const datePrefix = value.slice(0, 10).replaceAll("/", "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePrefix)) return null;
  const t1 = Date.parse(`${datePrefix}T00:00:00Z`);
  const t2 = Date.parse(`${todayJst}T00:00:00Z`);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.max(0, Math.round((t2 - t1) / 86_400_000));
}

export function classifyFreshnessDate(value: string | null | undefined, todayJst?: string): Freshness {
  if (value === undefined) return "none";
  if (value === null) return "failed";
  const ageDays = getAgeDaysFromDate(value, todayJst);
  if (ageDays === null) return "recent";
  if (ageDays <= 2) return "fresh";
  if (ageDays <= 7) return "recent";
  return "stale";
}
