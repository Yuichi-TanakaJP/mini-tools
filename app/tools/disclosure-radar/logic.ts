import type { DisclosureEventItem, DisclosureEventsManifest } from "./types";

export type RadarView = "yutai" | "my-stocks";
export type RangeDays = 1 | 7 | 30;
export type TopicFilter =
  | "all"
  | "important"
  | "new-expand"
  | "change-end"
  | "dividend"
  | "performance"
  | "capital"
  | "other";

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function normalizeSecurityCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return /^[0-9A-Z]{5}$/.test(normalized) && normalized.endsWith("0")
    ? normalized.slice(0, 4)
    : normalized;
}

export function selectDisclosureDates(
  manifest: DisclosureEventsManifest,
  rangeDays: RangeDays,
): string[] {
  if (rangeDays === 1) return manifest.latest ? [manifest.latest] : [];
  const referenceDate = manifest.dates.at(-1) ?? manifest.latest;
  if (!referenceDate) return [];
  const cutoff = addDays(referenceDate, -(rangeDays - 1));
  return manifest.dates.filter(
    (date) => date >= cutoff && date <= referenceDate,
  );
}

export function filterDisclosureEvents(
  items: DisclosureEventItem[],
  view: RadarView,
  myStockCodes: Set<string>,
  query: string,
  rangeDays: RangeDays,
  referenceDate: string,
  topic: TopicFilter,
  unreadOnly: boolean,
  readEventIds: Set<string>,
): DisclosureEventItem[] {
  if (!referenceDate) return [];
  const normalizedQuery = query.trim().toLowerCase();
  const cutoff = addDays(referenceDate, -(rangeDays - 1));

  return items.filter((item) => {
    if (item.disclosure_date < cutoff || item.disclosure_date > referenceDate) {
      return false;
    }
    if (view === "yutai" && item.audience !== "all") return false;
    if (
      view === "my-stocks" &&
      (item.audience !== "personal" ||
        !myStockCodes.has(normalizeSecurityCode(item.security_code)))
    ) {
      return false;
    }
    if (unreadOnly && readEventIds.has(item.event_id)) return false;
    if (topic === "important" && item.priority !== "high") return false;
    if (
      topic === "new-expand" &&
      item.event_type !== "yutai_new" &&
      item.event_type !== "yutai_expand"
    ) {
      return false;
    }
    if (
      topic === "change-end" &&
      item.event_type !== "yutai_change" &&
      item.event_type !== "yutai_end"
    ) {
      return false;
    }
    if (topic === "dividend" && !item.event_type.startsWith("dividend_")) {
      return false;
    }
    if (topic === "performance" && item.event_type !== "performance_revision") {
      return false;
    }
    if (
      topic === "capital" &&
      item.event_type !== "share_buyback" &&
      item.event_type !== "ma_reorganization"
    ) {
      return false;
    }
    if (
      topic === "other" &&
      item.event_type !== "governance" &&
      item.event_type !== "correction"
    ) {
      return false;
    }

    if (!normalizedQuery) return true;
    return `${item.security_code} ${item.company_name} ${item.title}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
}
