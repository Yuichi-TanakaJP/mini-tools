import type { DashboardData } from "./load";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

/** 銘柄IDごとの表示データRevision。ユーザー単位のキャッシュにだけ保存する。 */
export type StockNotesManifest = Record<string, string>;

export type StockNotesStockBundle = {
  stock: StockNoteStock;
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
  revision: string;
};

export type StockNotesDelta = {
  version: 1;
  complete: true;
  currentManifest: StockNotesManifest;
  changedStocks: StockNotesStockBundle[];
  deletedStockIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isManifest(value: unknown): value is StockNotesManifest {
  if (!isRecord(value)) return false;
  if (Object.keys(value).length > 2_000) return false;
  return Object.entries(value).every(
    ([stockId, revision]) =>
      stockId.length > 0 && stockId.length <= 128 && typeof revision === "string" && revision.length > 0,
  );
}

/** 外部APIレスポンスを構造レベルで検証する。詳細な行値は既存の描画側防御に委ねる。 */
export function parseStockNotesDelta(value: unknown): StockNotesDelta {
  if (!isRecord(value) || value.version !== 1 || value.complete !== true) {
    throw new Error("銘柄差分APIの応答形式が不正です。");
  }
  if (!isManifest(value.currentManifest) || !Array.isArray(value.changedStocks) || !Array.isArray(value.deletedStockIds)) {
    throw new Error("銘柄差分APIのmanifestが不正です。");
  }
  for (const item of value.changedStocks) {
    if (!isRecord(item) || !isRecord(item.stock) || typeof item.revision !== "string") {
      throw new Error("銘柄差分APIの変更データが不正です。");
    }
    if (!Array.isArray(item.analyses) || !Array.isArray(item.theses) || !Array.isArray(item.actions)) {
      throw new Error("銘柄差分APIの子データが不正です。");
    }
  }
  if (!value.deletedStockIds.every((id) => typeof id === "string")) {
    throw new Error("銘柄差分APIの削除一覧が不正です。");
  }
  const changedIds = new Set<string>();
  for (const item of value.changedStocks) {
    const stockId = (item.stock as { id?: unknown }).id;
    if (typeof stockId !== "string" || changedIds.has(stockId) || value.currentManifest[stockId] !== item.revision) {
      throw new Error("銘柄差分APIのRevision対応が不正です。");
    }
    changedIds.add(stockId);
  }
  const deletedIds = new Set(value.deletedStockIds);
  if (
    deletedIds.size !== value.deletedStockIds.length ||
    value.deletedStockIds.some((id) => value.currentManifest[id] !== undefined)
  ) {
    throw new Error("銘柄差分APIの削除一覧が不正です。");
  }
  return value as unknown as StockNotesDelta;
}

function mergeRows<T extends { id: string }>(
  base: T[],
  changed: T[],
  currentIds: Set<string>,
  changedIds: Set<string>,
): T[] {
  return [
    ...base.filter((row) => currentIds.has(row.id) && !changedIds.has(row.id)),
    ...changed,
  ];
}

function mergeChildRows<T extends { id: string; stockId: string }>(
  base: T[],
  changed: T[],
  currentIds: Set<string>,
  changedIds: Set<string>,
): T[] {
  return [
    ...base.filter((row) => currentIds.has(row.stockId) && !changedIds.has(row.stockId)),
    ...changed,
  ];
}

/**
 * 完全なdeltaレスポンスを前回のDashboardDataへ適用する。
 * replace=true はmanifestをまだ持たない旧キャッシュからの初回移行時に使う。
 * completeでないレスポンスは型で表現できないため、この関数へ渡す前に拒否する。
 */
export function mergeStockNotesDelta(
  base: DashboardData,
  delta: StockNotesDelta,
  replace: boolean,
): DashboardData {
  const changedIds = new Set(delta.changedStocks.map((bundle) => bundle.stock.id));
  const currentIds = new Set(Object.keys(delta.currentManifest));
  const baseData = replace
    ? { ...base, stocks: [], analyses: [], theses: [], actions: [] }
    : base;
  const changedAnalyses = delta.changedStocks.flatMap((bundle) => bundle.analyses);
  const changedTheses = delta.changedStocks.flatMap((bundle) => bundle.theses);
  const changedActions = delta.changedStocks.flatMap((bundle) => bundle.actions);

  return {
    ...baseData,
    stocks: mergeRows(
      baseData.stocks,
      delta.changedStocks.map((bundle) => bundle.stock),
      currentIds,
      changedIds,
    ),
    analyses: mergeChildRows(baseData.analyses, changedAnalyses, currentIds, changedIds),
    theses: mergeChildRows(baseData.theses, changedTheses, currentIds, changedIds),
    actions: mergeChildRows(baseData.actions, changedActions, currentIds, changedIds),
  };
}
