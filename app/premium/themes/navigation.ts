/** Only opaque, bounded list cursors are carried into detail/return URLs. */
export function themeListHref(cursor?: string | string[]): string {
  return typeof cursor === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(cursor)
    ? `/premium/themes?cursor=${encodeURIComponent(cursor)}`
    : "/premium/themes";
}
