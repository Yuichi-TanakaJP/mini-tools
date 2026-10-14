import { normalizeSecurityCode } from "@/app/tools/disclosure-radar/logic";
import type { TdnetDisclosureItem } from "./types";

/**
 * Filter the full TDNET disclosure source by the authenticated Portfolio holdings.
 *
 * Do NOT filter by Router event IDs or source_category. The important cases
 * include official documents that the existing Router deliberately leaves
 * unlabelled. Watchlist codes are excluded from this first holdings-only pilot.
 */
export function filterFullTdnetByHoldings(
  items: readonly TdnetDisclosureItem[],
  holdingCodes: ReadonlySet<string>,
): TdnetDisclosureItem[] {
  return items.filter((item) => holdingCodes.has(normalizeSecurityCode(item.security_code)));
}
