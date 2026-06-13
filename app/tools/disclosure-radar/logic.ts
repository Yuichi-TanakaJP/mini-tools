import type { DisclosureEventItem } from "./types";

export type RadarView = "yutai" | "my-stocks";

export function normalizeSecurityCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return /^[0-9A-Z]{5}$/.test(normalized) && normalized.endsWith("0")
    ? normalized.slice(0, 4)
    : normalized;
}

export function filterDisclosureEvents(
  items: DisclosureEventItem[],
  view: RadarView,
  myStockCodes: Set<string>,
  query: string,
): DisclosureEventItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    if (view === "yutai" && item.audience !== "all") return false;
    if (
      view === "my-stocks" &&
      (item.audience !== "personal" ||
        !myStockCodes.has(normalizeSecurityCode(item.security_code)))
    ) {
      return false;
    }

    if (!normalizedQuery) return true;
    return `${item.security_code} ${item.company_name} ${item.title}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
}
