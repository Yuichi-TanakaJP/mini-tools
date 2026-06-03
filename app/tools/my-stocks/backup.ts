// app/tools/my-stocks/backup.ts
import type { MyStockItem } from "./types";
import { newId, normalizeItems } from "./storage";

export const BACKUP_SCHEMA = "mini-tools/my-stocks";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  schema: typeof BACKUP_SCHEMA;
  version: number;
  exportedAt: string;
  items: MyStockItem[];
};

/** items をバックアップ JSON 文字列に直列化する。 */
export function serializeBackup(items: MyStockItem[]): string {
  const payload: BackupFile = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * バックアップ JSON 文字列を検証して items を取り出す。
 * - 直接 items 配列のみの JSON も受け付ける（寛容に）
 * - schema が一致しない / items が無い場合は null
 * 純粋関数（window 非依存）。
 */
export function parseBackupItems(text: string): MyStockItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  // 配列がそのまま渡されたケース
  if (Array.isArray(parsed)) {
    return normalizeItems(parsed);
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Partial<BackupFile>;
    if (obj.schema === BACKUP_SCHEMA && Array.isArray(obj.items)) {
      return normalizeItems(obj.items);
    }
  }

  return null;
}

export type MergeResult = {
  merged: MyStockItem[];
  added: number;
  skipped: number;
};

function mergeKey(item: MyStockItem): string {
  if (item.tab !== "holding") return `${item.tab}:${item.code}`;
  return `${item.tab}:${item.code}:${item.accountType ?? item.accountLabel ?? ""}`;
}

/**
 * 既存 items に incoming を非破壊マージする。
 * - 保有メモは同一コードでも口座区分が違えば別行として追加
 * - ウォッチは同一コードを既存優先でスキップ
 * - id が衝突する場合は新しい id を振り直す
 */
export function mergeItems(current: MyStockItem[], incoming: MyStockItem[]): MergeResult {
  const seenKeys = new Set(current.map(mergeKey));
  const usedIds = new Set(current.map((it) => it.id));

  const additions: MyStockItem[] = [];
  let skipped = 0;

  for (const item of incoming) {
    const key = mergeKey(item);
    if (seenKeys.has(key)) {
      skipped += 1;
      continue;
    }
    seenKeys.add(key);

    let id = item.id;
    if (usedIds.has(id)) id = newId();
    usedIds.add(id);

    additions.push({ ...item, id });
  }

  return {
    merged: [...additions, ...current],
    added: additions.length,
    skipped,
  };
}
