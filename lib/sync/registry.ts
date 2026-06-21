// lib/sync/registry.ts
// クロスデバイス同期の対象とする LocalStorage キー。
// ここに足すだけで同期対象を増やせる（サーバーは汎用 key-value なのでスキーマ変更不要）。
export const SYNCED_KEYS = [
  "yutai_memo_items_v1",
  "yutai_memo_tags_v1",
  "yutai_memo_archives_v1",
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];
