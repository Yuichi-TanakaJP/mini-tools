// app/tools/my-stocks/storage.ts
import type { MyStockItem, StockListTab } from "./types";

const ITEMS_KEY = "my_stocks_items_v1";

function isStockTab(value: unknown): value is StockListTab {
  return value === "holding" || value === "watch";
}

/**
 * localStorage から銘柄一覧を読む。
 * 壊れたデータや旧形式は読み取り時に正規化し、保存し直す。
 * SSR では window が無いので空配列を返す（hydration ガイドライン準拠）。
 */
export function loadItems(): MyStockItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
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
          addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
          updatedAt:
            typeof item.updatedAt === "number" ? item.updatedAt : item.addedAt ?? Date.now(),
        });
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

export function saveItems(items: MyStockItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  } catch {
    // 容量超過などは握りつぶす（UI 側で state は保持される）
  }
}
