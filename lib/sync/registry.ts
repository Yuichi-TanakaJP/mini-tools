// lib/sync/registry.ts
// クロスデバイス同期の対象とする LocalStorage キー。
// ここに足すだけで同期対象を増やせる（サーバーは汎用 key-value なのでスキーマ変更不要）。
export const SYNCED_KEYS = [
  // 優待メモ帳
  "yutai_memo_items_v1",
  "yutai_memo_tags_v1",
  "yutai_memo_archives_v1",

  // 優待カレンダー
  "monthly_yutai_picks_v1",
  "monthly_yutai_passes_v1",
  "monthly_yutai_card_memos_v1",

  // 株主優待期限帳
  "mini-tools:benefits:v2",

  // マイ銘柄
  "my_stocks_items_v1",
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];
