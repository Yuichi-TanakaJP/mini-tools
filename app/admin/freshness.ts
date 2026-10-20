export type Freshness = "fresh" | "recent" | "stale" | "failed" | "none" | "unknown";

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
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  if (new Date(t1).toISOString().slice(0, 10) !== datePrefix || new Date(t2).toISOString().slice(0, 10) !== todayJst) return null;
  const age = Math.round((t2 - t1) / 86_400_000);
  return age < 0 ? null : age;
}

export function classifyFreshnessDate(
  value: string | null | undefined,
  expectedMaxDays: number | null,
  todayJst?: string,
): Freshness {
  if (value === undefined) return "none";
  if (value === null) return "failed";
  const ageDays = getAgeDaysFromDate(value, todayJst);
  if (ageDays === null) return "unknown";
  if (ageDays <= 2) return "fresh";
  if (ageDays <= (expectedMaxDays ?? 7)) return "recent";
  return "stale";
}
