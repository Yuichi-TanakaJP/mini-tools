// lib/local-data-transfer.ts
// 端末内 LocalStorage の全データを JSON にエクスポート / インポートする。
// Phase 0: ログイン・サーバー不要の「機種変更の救済」用。将来のサーバー同期(Phase 1)とは独立。
// 各ツールが個別のキー（*_v1 など）を使うため、特定キーの一覧を持たず localStorage 全体を対象にする。
// これにより、ツールが増えてもこのファイルを更新せずに取りこぼしなくバックアップできる。

export const BACKUP_SCHEMA = "mini-tools-localstorage-backup";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  schema: string;
  version: number;
  /** エクスポート時刻（ISO 文字列） */
  exportedAt: string;
  /** エクスポート元のオリジン（参考情報） */
  origin?: string;
  /** data に含まれるキー数 */
  itemCount: number;
  /** localStorage のキー → 値（文字列）。値は各ツールが入れた JSON 文字列そのまま */
  data: Record<string, string>;
};

/** 現在の localStorage を全件読み出す。利用不可環境では空オブジェクト。 */
export function collectLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key == null) continue;
      const value = window.localStorage.getItem(key);
      if (value == null) continue;
      out[key] = value;
    }
  } catch {
    // localStorage が使えない環境では空のまま返す
  }
  return out;
}

/** 現在の localStorage からバックアップオブジェクトを作る。 */
export function buildBackup(): BackupFile {
  const data = collectLocalStorage();
  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
    itemCount: Object.keys(data).length,
    data,
  };
}

/** バックアップを保存用 JSON 文字列にする。 */
export function serializeBackup(backup: BackupFile = buildBackup()): string {
  return JSON.stringify(backup, null, 2);
}

// プロジェクトは strict:false（strictNullChecks 無効）のため判別可能ユニオンの絞り込みが効かない。
// 絞り込みに依存しないよう、成否を 1 つの型で表す。
export type ParseResult = {
  ok: boolean;
  backup?: BackupFile;
  error?: string;
};

/** JSON 文字列をバックアップとして検証して読み込む。 */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON として読み込めませんでした。" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "バックアップ形式ではありません。" };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schema !== BACKUP_SCHEMA) {
    return { ok: false, error: "mini-tools のバックアップファイルではありません。" };
  }
  if (typeof obj.data !== "object" || obj.data === null) {
    return { ok: false, error: "データ本体（data）が見つかりません。" };
  }
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj.data as Record<string, unknown>)) {
    // 値は文字列のみ受け入れる（localStorage の値は常に文字列のため）
    if (typeof v === "string") data[k] = v;
  }
  return {
    ok: true,
    backup: {
      schema: BACKUP_SCHEMA,
      version: typeof obj.version === "number" ? obj.version : 1,
      exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
      origin: typeof obj.origin === "string" ? obj.origin : undefined,
      itemCount: Object.keys(data).length,
      data,
    },
  };
}

export type ApplyMode = "merge" | "replace";

export type ApplyResult = { applied: number; removed: number };

/**
 * バックアップを localStorage へ書き戻す。
 * - merge: バックアップのキーを上書き・追記する（既存の他キーは残す）
 * - replace: バックアップに無い既存キーを削除してから書き込む（端末を丸ごと差し替え）
 */
export function applyBackup(backup: BackupFile, mode: ApplyMode = "merge"): ApplyResult {
  let applied = 0;
  let removed = 0;
  if (typeof window === "undefined") return { applied, removed };
  try {
    if (mode === "replace") {
      const keep = new Set(Object.keys(backup.data));
      const existing: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key != null) existing.push(key);
      }
      for (const key of existing) {
        if (!keep.has(key)) {
          window.localStorage.removeItem(key);
          removed++;
        }
      }
    }
    for (const [key, value] of Object.entries(backup.data)) {
      window.localStorage.setItem(key, value);
      applied++;
    }
  } catch {
    // 個別の書き込み失敗は無視し、できた分だけ反映する
  }
  return { applied, removed };
}
