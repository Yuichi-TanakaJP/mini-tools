// app/tools/my-stocks/storage.ts
import { markChanged } from "@/lib/sync/client";
import type { MyStockItem, StockAccountType, StockListTab } from "./types";

const ITEMS_KEY = "my_stocks_items_v1";

function isStockTab(value: unknown): value is StockListTab {
  return value === "holding" || value === "watch";
}

function isAccountType(value: unknown): value is StockAccountType {
  return (
    value === "specific" ||
    value === "nisa-growth" ||
    value === "nisa-tsumitate" ||
    value === "old-nisa" ||
    value === "general" ||
    value === "other"
  );
}

/** 端末・テスト双方で動く ID 生成。 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 任意の入力（localStorage / インポートファイル）を MyStockItem[] に正規化する。
 * 不正な要素は捨て、欠損フィールドは補完する。純粋関数（window 非依存）。
 */
export function normalizeItems(parsed: unknown): MyStockItem[] {
  if (!Array.isArray(parsed)) return [];

  const normalized: MyStockItem[] = [];
  for (const it of parsed) {
    if (
      it &&
      typeof it === "object" &&
      typeof (it as MyStockItem).id === "string" &&
      typeof (it as MyStockItem).code === "string" &&
      typeof (it as MyStockItem).name === "string" &&
      isStockTab((it as MyStockItem).tab)
    ) {
      const item = it as MyStockItem;
      normalized.push({
        ...item,
        market: typeof item.market === "string" ? item.market : "",
        sector: typeof item.sector === "string" ? item.sector : null,
        accountType: isAccountType(item.accountType) ? item.accountType : null,
        accountLabel:
          typeof item.accountLabel === "string" && item.accountLabel.trim()
            ? item.accountLabel
            : null,
        addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
        updatedAt:
          typeof item.updatedAt === "number" ? item.updatedAt : item.addedAt ?? Date.now(),
      });
    }
  }
  return normalized;
}

/**
 * localStorage から銘柄一覧を読む。
 * SSR では window が無いので空配列を返す（hydration ガイドライン準拠）。
 */
export function loadItems(): MyStockItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    return normalizeItems(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveItems(items: MyStockItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    markChanged(ITEMS_KEY);
  } catch {
    // 容量超過などは握りつぶす（UI 側で state は保持される）
  }
}
