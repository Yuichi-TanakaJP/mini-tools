// lib/sync/client.ts
// クライアント側の同期ロジック。/api/sync と LocalStorage の橋渡し。
// 設計: docs/plans/phase1-cross-device-sync-plan.md
// - キー単位 last-write-wins（updatedAt の新しい方を採用）
// - LocalStorage は手元の正＝キャッシュ。サーバーはバックアップ兼デバイス間共有。
import { SYNCED_KEYS } from "./registry";

const META_KEY = "mini_tools_sync_meta_v1";
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

function localUpdatedAtForPush(key: string, meta: Meta, value: unknown): string | null {
  if (meta[key]?.updatedAt) return meta[key].updatedAt;

  // メタ無しの空値は、新しい端末が作った初期値の可能性が高い。
  // これを「今」として送ると、別端末の実データを空で上書きしてしまうため送らない。
  if (isEmptyLocalValue(value)) return null;

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

/** サーバーへローカルの同期対象キーを送る（より新しい方をサーバーが採用）。 */
export async function pushAll(): Promise<{ ok: boolean; error?: string }> {
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
    for (const it of data.items ?? []) {
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** サーバーから取得し、より新しいものだけ LocalStorage に反映する。変わったキー名を返す。 */
export async function pullAll(
  options: { unknownLocalPolicy?: PullUnknownLocalPolicy } = {},
): Promise<{ ok: boolean; changed: string[]; error?: string }> {
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
      const localAt = localUpdatedAtForPull(it.key, meta, unknownLocalPolicy);
      if (new Date(it.updatedAt).getTime() > new Date(localAt).getTime()) {
        try {
          const serialized =
            typeof it.value === "string" ? it.value : JSON.stringify(it.value);
          window.localStorage.setItem(it.key, serialized);
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