// app/tools/yutai-memo/types.ts
export type Tag = {
  id: string;
  name: string;
  createdAt: number;
};

export const CROSS_TYPES = [
  "長期優遇なし",
  "単発クロス",
  "連続クロス",
  "先行クロス",
  "1株放置",
] as const;

export type CrossType = (typeof CROSS_TYPES)[number];

export type MemoItem = {
  id: string;
  name: string;
  code?: string;
  createdAt: string; // ISO
  months: number[]; // 1-12 (複数可)
  tagIds: string[]; // ★ tags -> tagIds
  crossType: CrossType;
  entryTiming?: string; // 早打ち目安
  relatedUrl?: string; // 関連リンク
  tenureRule?: string; // 任期条件
  acquired: boolean; // 取得済みか
  oneShareStartedAt?: string; // YYYY-MM or freeform when legacy start month is unknown
  oneShareHold?: boolean; // legacy compatibility
  priority: 1 | 2 | 3;
  memo: string;
  updatedAt: string; // ISO
};

export type ArchivedMemoItem = {
  id: string;
  memoId: string;
  code?: string;
  name: string;
  acquiredAt: string; // ISO
  entitlementMonthKey?: string; // YYYY-MM (権利月ベース)
  note?: string;
};

export const DEFAULT_TAGS: Tag[] = [
  { id: "early", name: "早取り", createdAt: 0 },
  { id: "one_share", name: "長期1株", createdAt: 0 },
  { id: "tenure", name: "任期注意", createdAt: 0 },
  { id: "failure", name: "失敗ログ", createdAt: 0 },
  { id: "must", name: "鉄板", createdAt: 0 },
];
