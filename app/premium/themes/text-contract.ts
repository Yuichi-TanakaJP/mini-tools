import type { ThemeTextChunk } from "./types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TEXT_FIELDS: Record<string, readonly string[]> = {
  analysisHistory: ["body", "conclusion", "evidence", "concerns"],
  thesisHistory: ["definition", "structuralHypothesis", "lenses", "risks", "falsificationConditions", "nextChecks"],
  evidence: ["claim", "sourceTitle"], openActions: ["detail", "triggerCondition", "outcomeNote"],
  directLinks: ["relationNote", "verificationNote", "sourceTitle"],
  "taxonomyMap.themeLinks": ["relationNote"], "taxonomyMap.nodes": ["description"],
  "taxonomyMap.edges": ["relationNote"], "taxonomyMap.stockLinks": ["relationNote"],
  "metrics.definitions": ["definition"], "metrics.snapshots": ["note"], "metrics.values": ["calculationNote"],
};
export type ThemeTextRequest = {
  themeId: string; section: string; recordId: string; field: string; offset: number; revision?: string;
};
export function isThemeTextRequest(r: ThemeTextRequest): boolean {
  return UUID.test(r.themeId) && UUID.test(r.recordId) && Object.hasOwn(TEXT_FIELDS, r.section) && TEXT_FIELDS[r.section].includes(r.field) &&
    Number.isSafeInteger(r.offset) && r.offset >= 0 &&
    (r.revision === undefined ? r.offset === 0 : /^[a-f0-9]{64}$/.test(r.revision));
}
/** Python/API offsets count Unicode code points, never JS UTF-16 code units. */
export function validateThemeTextChunk(value: unknown, request: ThemeTextRequest): ThemeTextChunk {
  if (!value || typeof value !== "object") throw new Error("invalid text chunk");
  const c = value as ThemeTextChunk;
  const length = typeof c.text === "string" ? Array.from(c.text).length : -1;
  const end = request.offset + length;
  if (c.schemaVersion !== "theme-viewer-text.v1" || c.themeId !== request.themeId ||
    c.section !== request.section || c.recordId !== request.recordId || c.field !== request.field ||
    c.offset !== request.offset || !Number.isSafeInteger(c.totalChars) || c.totalChars < end ||
    (typeof c.revision !== "string" || !/^[a-f0-9]{64}$/.test(c.revision)) || (request.revision !== undefined && c.revision !== request.revision) ||
    length < 0 || length > 2000 || typeof c.hasMore !== "boolean" ||
    c.hasMore !== (end < c.totalChars) || c.nextOffset !== (c.hasMore ? end : null) ||
    (c.hasMore && length === 0)) throw new Error("inconsistent text chunk");
  return c;
}
