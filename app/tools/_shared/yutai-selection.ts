// 月次優待候補のピック / パス / カードメモの LocalStorage 読み書き。
// yutai-candidates と yutai-dashboard は同じキーを共有し、選択状態を両画面で整合させる。
// 位置づけ: docs/decision-log/2026-07-05-yutai-dashboard-positioning.md
import { markChanged } from "@/lib/sync/client";
import type { MemoItem } from "@/app/tools/yutai-memo/types";
import type { MonthlyYutaiCandidate } from "@/app/tools/yutai-candidates/types";

export const MONTHLY_YUTAI_PICKED_KEY = "monthly_yutai_picks_v1";
export const MONTHLY_YUTAI_PASSED_KEY = "monthly_yutai_passes_v1";
export const MONTHLY_YUTAI_CARD_MEMOS_KEY = "monthly_yutai_card_memos_v1";

export type CalendarCardMemo = {
  longTermRequired: boolean;
  longTermBenefit: boolean;
  preparationMonthsBefore?: number;
  requiredShares?: number;
  benefitValueYen?: number;
  updatedAt: string;
};

export function loadCodeSet(storageKey: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function saveCodeSet(storageKey: string, codes: Set<string>, options: { markChanged?: boolean } = {}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify([...codes]));
  if (options.markChanged ?? true) markChanged(storageKey);
}

export function getCardMemoKey(item: Pick<MonthlyYutaiCandidate, "code" | "month">) {
  return `${item.code}:${item.month}`;
}

export function loadCardMemos(): Record<string, CalendarCardMemo> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MONTHLY_YUTAI_CARD_MEMOS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<CalendarCardMemo>>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => typeof key === "string" && value && typeof value === "object")
        .map(([key, value]) => [
          key,
          {
            longTermRequired: Boolean(value.longTermRequired),
            longTermBenefit: Boolean(value.longTermBenefit),
            preparationMonthsBefore:
              typeof value.preparationMonthsBefore === "number" &&
              Number.isInteger(value.preparationMonthsBefore) &&
              value.preparationMonthsBefore >= 0 &&
              value.preparationMonthsBefore <= 11
                ? value.preparationMonthsBefore
                : undefined,
            requiredShares:
              typeof value.requiredShares === "number" &&
              Number.isInteger(value.requiredShares) &&
              value.requiredShares > 0
                ? value.requiredShares
                : undefined,
            benefitValueYen:
              typeof value.benefitValueYen === "number" &&
              Number.isInteger(value.benefitValueYen) &&
              value.benefitValueYen > 0
                ? value.benefitValueYen
                : undefined,
            updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
          },
        ]),
    );
  } catch {
    return {};
  }
}

export function saveCardMemos(memos: Record<string, CalendarCardMemo>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MONTHLY_YUTAI_CARD_MEMOS_KEY, JSON.stringify(memos));
  markChanged(MONTHLY_YUTAI_CARD_MEMOS_KEY);
}

export function getAddedKeysFromMemoItems(items: MemoItem[]) {
  return new Set(
    items.flatMap((item) => (item.months ?? []).map((month) => `${item.code ?? ""}:${month}`)),
  );
}
