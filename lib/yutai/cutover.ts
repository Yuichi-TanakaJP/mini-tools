/** One build-time switch enables every Yutai DB screen and disables legacy writes. */
export function yutaiDatabaseCanonical() {
  return process.env.NEXT_PUBLIC_YUTAI_DB_CANONICAL === "true";
}
export const legacyYutaiKeys = new Set([
  "yutai_memo_items_v1", "yutai_memo_tags_v1", "yutai_memo_archives_v1",
  "monthly_yutai_picks_v1", "monthly_yutai_passes_v1", "monthly_yutai_card_memos_v1",
  "mini-tools:benefits:v2",
]);
export function legacyYutaiWriteBlocked(key: string) {
  return yutaiDatabaseCanonical() && legacyYutaiKeys.has(key);
}
