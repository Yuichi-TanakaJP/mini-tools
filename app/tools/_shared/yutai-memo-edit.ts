// 優待メモの部分編集ロジック。優待カレンダー・優待ダッシュボードの両方から使う想定の純関数。
// UI（React state / styles）には依存せず、items 配列の更新のみを扱う。
import type { CrossType, MemoItem } from "@/app/tools/yutai-memo/types";

export type MemoEditDraft = {
  name: string;
  crossType: CrossType;
  entryTiming: string;
  preparationMonthsBefore: number | "";
  oneShareStartedAt: string;
  relatedUrl: string;
  tenureRule: string;
  acquired: boolean;
  priority: 1 | 2 | 3;
  memo: string;
};

/** MemoItem から編集フォームの初期 draft を作る。 */
export function buildMemoEditDraft(item: MemoItem): MemoEditDraft {
  return {
    name: item.name,
    crossType: item.crossType,
    entryTiming: item.entryTiming ?? "",
    preparationMonthsBefore: item.preparationMonthsBefore ?? "",
    oneShareStartedAt: item.oneShareStartedAt ?? "",
    relatedUrl: item.relatedUrl ?? "",
    tenureRule: item.tenureRule ?? "",
    acquired: item.acquired,
    priority: item.priority,
    memo: item.memo,
  };
}

export type ApplyMemoEditResult = {
  items: MemoItem[];
  updated: boolean;
};

/**
 * id 一致の MemoItem に draft を反映した新しい配列を返す。
 * 空文字は「未設定（undefined）」に正規化する。name が空なら元の名前を維持する。
 */
export function applyMemoEdit(
  items: MemoItem[],
  id: string,
  draft: MemoEditDraft,
  now: string,
): ApplyMemoEditResult {
  let updated = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    updated = true;
    return {
      ...item,
      name: draft.name.trim() || item.name,
      crossType: draft.crossType,
      entryTiming: draft.entryTiming.trim() || undefined,
      preparationMonthsBefore: draft.preparationMonthsBefore === "" ? undefined : draft.preparationMonthsBefore,
      oneShareStartedAt: draft.oneShareStartedAt.trim() || undefined,
      relatedUrl: draft.relatedUrl.trim() || undefined,
      tenureRule: draft.tenureRule.trim() || undefined,
      acquired: draft.acquired,
      acquiredMarkedAt: draft.acquired ? (item.acquiredMarkedAt ?? now) : undefined,
      priority: draft.priority,
      memo: draft.memo.trim(),
      updatedAt: now,
    };
  });
  return { items: next, updated };
}
