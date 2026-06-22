// lib/sync/client.ts
// クライアント側の同期ロジック。/api/sync と LocalStorage の橋渡し。
// 設計: docs/plans/phase1-cross-device-sync-plan.md
// - キー単位 last-write-wins（updatedAt の新しい方を採用）
// - LocalStorage は手元の正＝キャッシュ。サーバーはバックアップ兼デバイス間共有。
import { SYNCED_KEYS } from "./registry";

const META_KEY = "mini_tools_sync_meta_v1";
const SAFETY_BACKUP_PREFIX = "mini_tools_sync_safety_backup_v1:";
const MAX_SAFETY_BACKUPS = 3;
const EPOCH = "1970-01-01T00:00:00.000Z";

type SyncItem = { key: string; value: unknown; updatedAt: string };
type Meta = Record<string, { updatedAt: string }>;
type PullUnknownLocalPolicy = "preserve" | "restore";

function readMeta(): Meta {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Meta) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta: Meta) {
  try {
    pruneSafetyBackups();
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function setMetaUpdatedAt(key: string, updatedAt: string) {
  const meta = readMeta();
  meta[key] = { updatedAt };
  writeMeta(meta);
}

/** ツールがローカル保存した直後に呼ぶ。次回 push でサーバーへ反映される。 */
export function markChanged(key: string) {
  setMetaUpdatedAt(key, new Date().toISOString());
}

function readLocalValue(key: string): { value: unknown } | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw == null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // JSON でない値はそのまま文字列として送る
    value = raw;
  }
  return { value };
}

function writeLocalValue(key: string, value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  window.localStorage.setItem(key, serialized);
}

function isEmptyLocalValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function pruneSafetyBackups() {
  if (typeof window === "undefined") return;
  try {
    const backupKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(SAFETY_BACKUP_PREFIX)) backupKeys.push(key);
    }
    backupKeys.sort().reverse();
    for (const key of backupKeys.slice(MAX_SAFETY_BACKUPS)) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
function saveSafetyBackup(reason: "push" | "pull") {
  if (typeof window === "undefined") return;
  try {
    const values: Record<string, string> = {};
    for (const key of SYNCED_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (raw != null) values[key] = raw;
    }
    if (Object.keys(values).length === 0) return;
    const payload = {
      schema: "mini-tools-sync-safety-backup",
      version: 1,
      reason,
      exportedAt: new Date().toISOString(),
      values,
    };
    window.localStorage.setItem(
      `${SAFETY_BACKUP_PREFIX}${Date.now()}`,
      JSON.stringify(payload),
    );
    pruneSafetyBackups();
  } catch {
    // backup failure must not block the user action
  }
}

function nextIsoAfter(updatedAt: string): string {
  const serverTime = new Date(updatedAt).getTime();
  const nextTime = Number.isFinite(serverTime)
    ? Math.max(Date.now(), serverTime + 1)
    : Date.now();
  return new Date(nextTime).toISOString();
}

function localUpdatedAtForPush(key: string, meta: Meta, value: unknown): string | null {
  // Empty arrays/objects are not uploaded by the sync layer. This deliberately
  // disables cross-device "delete all" for now because an accidental empty value
  // can otherwise erase the only good copy on the server.
  if (isEmptyLocalValue(value)) return null;

  if (meta[key]?.updatedAt) return meta[key].updatedAt;

  // メタ導入前から存在する実データは、初回ログイン時にサーバーへ吸い上げる。
  return new Date().toISOString();
}

function localUpdatedAtForPull(
  key: string,
  meta: Meta,
  unknownLocalPolicy: PullUnknownLocalPolicy,
): string {
  if (meta[key]?.updatedAt) return meta[key].updatedAt;

  if (unknownLocalPolicy === "preserve") {
    const local = readLocalValue(key);
    if (local && !isEmptyLocalValue(local.value)) {
      return new Date().toISOString();
    }
  }

  // メタ無しのローカル値は更新時刻が不明。手動復元ではサーバー側を優先できるよう epoch とみなす。
  return EPOCH;
}

function collectLocalItems(): SyncItem[] {
  const meta = readMeta();
  const items: SyncItem[] = [];
  for (const key of SYNCED_KEYS) {
    const local = readLocalValue(key);
    if (!local) continue;
    const updatedAt = localUpdatedAtForPush(key, meta, local.value);
    if (!updatedAt) continue;
    items.push({ key, value: local.value, updatedAt });
  }
  return items;
}

async function pushAllInternal(
  retryEmptyServerRepair: boolean,
): Promise<{ ok: boolean; error?: string }> {
  saveSafetyBackup("push");
  const items = collectLocalItems();
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { items?: SyncItem[] };
    const sentKeys = new Set(items.map((it) => it.key));
    let shouldRetry = false;
    for (const it of data.items ?? []) {
      if (isEmptyLocalValue(it.value)) {
        const local = readLocalValue(it.key);
        if (local && !isEmptyLocalValue(local.value)) {
          setMetaUpdatedAt(it.key, nextIsoAfter(it.updatedAt));
          shouldRetry = true;
        }
        continue;
      }
      const local = readLocalValue(it.key);
      const shouldApplyServerValue =
        sentKeys.has(it.key) || !local || isEmptyLocalValue(local.value);
      if (!shouldApplyServerValue) continue;
      try {
        writeLocalValue(it.key, it.value);
        setMetaUpdatedAt(it.key, it.updatedAt);
      } catch {
        // ignore individual hydration failures
      }
    }
    if (shouldRetry && retryEmptyServerRepair) {
      return pushAllInternal(false);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** サーバーへローカルの同期対象キーを送る（より新しい方をサーバーが採用）。 */
export async function pushAll(): Promise<{ ok: boolean; error?: string }> {
  return pushAllInternal(true);
}

/** サーバーから取得し、より新しいものだけ LocalStorage に反映する。変わったキー名を返す。 */
export async function pullAll(
  options: { unknownLocalPolicy?: PullUnknownLocalPolicy } = {},
): Promise<{ ok: boolean; changed: string[]; error?: string }> {
  saveSafetyBackup("pull");
  const unknownLocalPolicy = options.unknownLocalPolicy ?? "restore";
  try {
    const res = await fetch("/api/sync", { method: "GET" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, changed: [], error: body.error ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { items?: SyncItem[] };
    const meta = readMeta();
    const changed: string[] = [];
    for (const it of data.items ?? []) {
      if (isEmptyLocalValue(it.value)) continue;
      const localAt = localUpdatedAtForPull(it.key, meta, unknownLocalPolicy);
      if (new Date(it.updatedAt).getTime() > new Date(localAt).getTime()) {
        try {
          writeLocalValue(it.key, it.value);
          setMetaUpdatedAt(it.key, it.updatedAt);
          changed.push(it.key);
        } catch {
          // ignore individual failures
        }
      }
    }
    return { ok: true, changed };
  } catch (e) {
    return { ok: false, changed: [], error: String(e) };
  }
}