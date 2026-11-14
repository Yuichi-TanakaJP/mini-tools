import { parseMonitoringMetadata } from "./monitoring";
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
  monitoringMetadataVersion: 1;
  complete: true;
  currentManifest: StockNotesManifest;
  changedStocks: StockNotesStockBundle[];
  deletedStockIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const MAX_STOCK_NOTES_OUTPUT_ENTRIES = 100_000;
const MAX_REQUEST_MANIFEST_ENTRIES = 2_000;

function isManifest(value: unknown, maxEntries = MAX_STOCK_NOTES_OUTPUT_ENTRIES): value is StockNotesManifest {
  if (!isRecord(value)) return false;
  if (Object.keys(value).length > maxEntries) return false;
  return Object.entries(value).every(
    ([stockId, revision]) =>
      stockId.length > 0 && stockId.length <= 128 && typeof revision === "string" && revision.length > 0 && revision.length <= 256,
  );
}

/** Oversized or malformed requests ask for a full snapshot; both callers use this exact wire manifest. */
export function normalizeStockNotesRequestManifest(value: unknown): StockNotesManifest {
  return isManifest(value, MAX_REQUEST_MANIFEST_ENTRIES) ? Object.fromEntries(Object.entries(value)) : {};
}

/** 外部APIレスポンスを構造レベルで検証する。詳細な行値は既存の描画側防御に委ねる。 */
export function parseStockNotesDelta(value: unknown, knownManifest: StockNotesManifest = {}): StockNotesDelta {
  if (!isRecord(value) || value.version !== 1 || value.monitoringMetadataVersion !== 1 || value.complete !== true) {
    throw new Error("銘柄差分APIの応答形式が不正です。");
  }
  if (!isManifest(value.currentManifest) || !Array.isArray(value.changedStocks) || !Array.isArray(value.deletedStockIds)) {
    throw new Error("銘柄差分APIのmanifestが不正です。");
  }
  const currentManifest = value.currentManifest;
  for (const item of value.changedStocks) {
    if (!isRecord(item) || !isRecord(item.stock) || typeof item.revision !== "string") {
      throw new Error("銘柄差分APIの変更データが不正です。");
    }
    parseMonitoringMetadata(item.stock.watchPurposes, item.stock.creditMonitoringEnabled);
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
    if (typeof stockId !== "string" || changedIds.has(stockId) || !Object.hasOwn(currentManifest, stockId) || currentManifest[stockId] !== item.revision) {
      throw new Error("銘柄差分APIのRevision対応が不正です。");
    }
    changedIds.add(stockId);
  }
  const deletedIds = new Set(value.deletedStockIds);
  if (
    deletedIds.size !== value.deletedStockIds.length ||
    value.deletedStockIds.some((id) => Object.hasOwn(currentManifest, id))
  ) {
    throw new Error("銘柄差分APIの削除一覧が不正です。");
  }
  const expectedChanged = Object.keys(currentManifest).filter((id) =>
    !Object.hasOwn(knownManifest, id) || knownManifest[id] !== currentManifest[id]);
  const expectedDeleted = Object.keys(knownManifest).filter((id) => !Object.hasOwn(currentManifest, id));
  if (changedIds.size !== expectedChanged.length || expectedChanged.some((id) => !changedIds.has(id)) ||
    deletedIds.size !== expectedDeleted.length || expectedDeleted.some((id) => !deletedIds.has(id))) {
    throw new Error("銘柄差分APIの変更・削除一覧が要求manifestと一致しません。");
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
