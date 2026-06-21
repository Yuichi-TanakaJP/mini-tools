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

// 比較用のローカル updatedAt。
// - meta があればそれ
// - meta が無く、ローカルに値があれば「今」（＝初回ログイン時にローカルを優先＝サーバーへ吸い上げ）
// - meta が無く、値も無ければ epoch（＝サーバーがあれば復元される）
function effectiveLocalUpdatedAt(key: string, meta: Meta): string {
  if (meta[key]?.updatedAt) return meta[key].updatedAt;
  try {
    return window.localStorage.getItem(key) != null ? new Date().toISOString() : EPOCH;
  } catch {
    return EPOCH;
  }
}

function collectLocalItems(): SyncItem[] {
  const meta = readMeta();
  const items: SyncItem[] = [];
  for (const key of SYNCED_KEYS) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw == null) continue;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      // JSON でない値はそのまま文字列として送る
      value = raw;
    }
    items.push({ key, value, updatedAt: effectiveLocalUpdatedAt(key, meta) });
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
    // サーバー確定の updatedAt で meta を更新しておく。
    for (const it of data.items ?? []) {
      setMetaUpdatedAt(it.key, it.updatedAt);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** サーバーから取得し、より新しいものだけ LocalStorage に反映する。変わったキー名を返す。 */
export async function pullAll(): Promise<{ ok: boolean; changed: string[]; error?: string }> {
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
      const localAt = effectiveLocalUpdatedAt(it.key, meta);
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
