/** Ignore same-document, external, download and modified-click navigation. */
export function internalNavigationTarget(href: string, current: string): string | null {
  let from: URL;
  let to: URL;
  try { from = new URL(current); to = new URL(href, from); } catch { return null; }
  if (to.origin !== from.origin || !["http:", "https:"].includes(to.protocol)) return null;
  if (to.pathname === from.pathname && to.search === from.search) return null;
  return to.pathname + to.search + to.hash;
}
