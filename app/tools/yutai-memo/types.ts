// app/tools/yutai-memo/types.ts
export type TagKey = "early" | "one_share" | "tenure" | "failure" | "must";

export type MemoItem = {
  id: string;
  name: string;
  code?: string;
  months: number[]; // 1-12 (複数可)
  tags: TagKey[];
  entryTiming?: string; // 早打ち目安
  tenureRule?: string; // 任期条件
  oneShareHold: boolean;
  priority: 1 | 2 | 3;
  memo: string;
  updatedAt: string; // ISO
};

export const TAG_LABEL: Record<TagKey, string> = {
  early: "早取り",
  one_share: "長期1株",
  tenure: "任期注意",
  failure: "失敗ログ",
  must: "鉄板",
};
