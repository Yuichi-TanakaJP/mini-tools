// app/tools/stock-notes/cache.ts
// stale-while-revalidate 用の localStorage キャッシュ（読み取り専用ダッシュボードの表示高速化用）。
// window / React に依存しない純関数中心のモジュール（単体テスト用）。
//
// 設計方針（詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md）:
// - キーにログインユーザーIDを含める（別アカウントのデータ混入防止）
// - TTL 15分。分析は週に数回しか増えず、決算API（/api/stock-notes/earnings）は既に
//   Cache-Control: max-age=300（5分）でキャッシュ済みのため、ダッシュボード全体を
//   これより短い周期で再取得しても実質的な鮮度向上は薄い。一方でセッションを長時間
//   放置したまま古いデータを見せ続けないよう、上限として15分を設定する。
// - スキーマバージョンを持たせる（version）。過去に lastEarnings の形式変更で
//   キャッシュ互換性の問題を起こしたことがあるため、形式を変えたら version を上げて
//   古いキャッシュを機械的に無効化できるようにする。
// - 読み出しは防御的に行う: JSON parse 失敗・バージョン不一致・userId不一致・形が壊れている
//   ・TTL超過のいずれでも例外を投げず null を返し、呼び出し側は通常取得にフォールバックする。
// - 書き込み失敗（localStorage の容量超過・プライベートモード等）も握りつぶす。
import type { DashboardData } from "./load";
import type { StockNotesManifest } from "./delta";

const CACHE_KEY_PREFIX = "stock_notes_dashboard_cache_v1_";
const CACHE_VERSION = 1;

/**
 * キャッシュの有効期限（ミリ秒）。根拠は本ファイル冒頭のコメントを参照。
 * この時間を過ぎたキャッシュは readStockNotesCache が null を返し（＝存在しない扱い）、
 * stale-while-revalidate の「即座に描画」対象から外れて通常のローディング表示になる。
 */
export const CACHE_TTL_MS = 15 * 60 * 1000;

/** キャッシュ本体に保存するデータ。DashboardData をそのまま使う（body は元々含まれていない）。 */
export type CachedStockNotesData = DashboardData;

type StockNotesCacheEnvelope = {
  version: typeof CACHE_VERSION;
  userId: string;
  /** このキャッシュを保存した時刻（ISO文字列）。TTL判定と「最終更新 HH:MM」表示の両方に使う。 */
  fetchedAt: string;
  data: CachedStockNotesData;
  /** 差分API用。旧キャッシュには無くても読み込める。 */
  manifest?: StockNotesManifest;
};

export type ReadCacheResult = {
  data: CachedStockNotesData;
  fetchedAt: string;
  manifest: StockNotesManifest | null;
};

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidManifest(value: unknown): value is StockNotesManifest {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).length > 2_000) return false;
  return Object.entries(value).every(
    ([stockId, revision]) =>
      stockId.length > 0 && stockId.length <= 128 && typeof revision === "string" && revision.length > 0,
  );
}

/**
 * 保存されている値が期待する envelope の形かどうかを防御的に検証する。
 * フィールドの詳細な中身（配列の各要素の形、enum相当のフィールドの値の妥当性等）までは
 * 検証しない。過剰に厳格化するとキャッシュがヒットしにくくなり stale-while-revalidate の
 * 効果が薄れるため、「読み出し側が配列/オブジェクトとして扱えるか」の構造レベルの検証に
 * とどめる（例: `stocks` が配列であること）。ここを通過した後、個々の値（`view` /
 * `confidence` / `category` 等の閉じた union）が想定外の場合は、キャッシュを丸ごと
 * 捨てるのではなく描画側（`ToolClient.tsx`）で安全な既定値にフォールバックする方針にした
 * （`logic.ts` の `withFallback`）。これは Supabase から直接取得した場合も同じ形の
 * リスクがある（DBスキーマ変更・手動編集等で想定外の値が入りうる）ため、キャッシュ層
 * だけで防御しても不十分だからである。
 *
 * ただし `earnings` はネストしたオブジェクトの参照（`earnings.earnings[code]` /
 * `earnings.lastEarnings[code]`）がそのまま行われるため、`earnings` 自体・
 * `earnings.earnings` ・`earnings.lastEarnings` がオブジェクトであることまでは検証する
 * （例えば `earnings: {}` のような値を通すと、この2つのプロパティへのアクセスで
 * 画面がクラッシュする）。このケースは「安全な既定へのフォールバック」では救えない
 * （何が正しい既定か決められない構造的な破損のため）ので、キャッシュ全体を無効化する。
 */
function isValidEarnings(value: unknown): boolean {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  return isPlainObject(value.earnings) && isPlainObject(value.lastEarnings);
}

function isValidEnvelope(value: unknown, userId: string): value is StockNotesCacheEnvelope {
  if (!isPlainObject(value)) return false;
  if (value.version !== CACHE_VERSION) return false;
  if (value.userId !== userId) return false;
  if (typeof value.fetchedAt !== "string") return false;
  if (value.manifest !== undefined && !isValidManifest(value.manifest)) return false;
  if (!isPlainObject(value.data)) return false;
  const data = value.data;
  return (
    Array.isArray(data.stocks) &&
    Array.isArray(data.analyses) &&
    Array.isArray(data.theses) &&
    Array.isArray(data.actions) &&
    Array.isArray(data.holdings) &&
    isValidEarnings(data.earnings)
  );
}

/**
 * キャッシュを読む。以下のいずれかに該当する場合は null を返す（例外は投げない）。
 * - localStorage が使えない（SSR・プライベートモード等）
 * - 該当キーが無い
 * - JSON.parse に失敗
 * - version が保存時と一致しない（スキーマ変更後の古いキャッシュ）
 * - userId が一致しない（別アカウントのデータ）
 * - 形が壊れている（配列であるべきフィールドが配列でない等）
 * - fetchedAt から TTL（15分）を超過している
 */
export function readStockNotesCache(userId: string, now: number = Date.now()): ReadCacheResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidEnvelope(parsed, userId)) return null;
    const fetchedAtMs = new Date(parsed.fetchedAt).getTime();
    if (!Number.isFinite(fetchedAtMs)) return null;
    if (now - fetchedAtMs > CACHE_TTL_MS) return null;
    return { data: parsed.data, fetchedAt: parsed.fetchedAt, manifest: parsed.manifest ?? null };
  } catch {
    return null;
  }
}

/**
 * キャッシュを書く。容量超過・プライベートモード等での失敗は握りつぶし、
 * 通常動作（キャッシュ無しの都度取得）を継続させる。
 */
export function writeStockNotesCache(
  userId: string,
  data: CachedStockNotesData,
  now: number = Date.now(),
  manifest?: StockNotesManifest,
): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: StockNotesCacheEnvelope = {
      version: CACHE_VERSION,
      userId,
      fetchedAt: new Date(now).toISOString(),
      data,
      ...(manifest ? { manifest } : {}),
    };
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(envelope));
  } catch {
    // localStorage の容量超過・プライベートモード等。キャッシュ無しの通常動作を継続する。
  }
}

/**
 * キャッシュを明示的に破棄する。
 *
 * 現状の呼び出し元はログアウト時のみ（同じ端末を他人が使う場合に、前のユーザーの
 * 分析内容が残らないようにするため）。
 *
 * 将来この画面に銘柄登録・分類変更・アーカイブ等の「書き込み」機能を追加するときは、
 * 書き込み成功後に必ずこの関数を呼ぶこと。呼び忘れると、書き込み後の再読み込みで
 * 古いキャッシュが復元され、「登録したのに画面に出ない」ように見える不具合になる。
 * 詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export function invalidateStockNotesCache(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(userId));
  } catch {
    // 削除失敗も握りつぶす（次回の writeStockNotesCache で上書きされるため実害は小さい）
  }
}
