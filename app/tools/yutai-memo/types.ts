// app/tools/yutai-memo/types.ts
export type Tag = {
  id: string;
  name: string;
  createdAt: number;
};

export type MemoItem = {
  id: string;
  name: string;
  code?: string;
  months: number[]; // 1-12 (複数可)
  tagIds: string[]; // ★ tags -> tagIds
  entryTiming?: string; // 早打ち目安
  tenureRule?: string; // 任期条件
  oneShareHold: boolean;
  priority: 1 | 2 | 3;
  memo: string;
  updatedAt: string; // ISO
};

export const DEFAULT_TAGS: Tag[] = [
  { id: "early", name: "早取り", createdAt: 0 },
  { id: "one_share", name: "長期1株", createdAt: 0 },
  { id: "tenure", name: "任期注意", createdAt: 0 },
  { id: "failure", name: "失敗ログ", createdAt: 0 },
  { id: "must", name: "鉄板", createdAt: 0 },
];
