// app/tools/yutai-expiry/benefits/store.ts

// 1) types
export type TrackMode = "count" | "amount";

// 簡易利用履歴（追記のみ）。count は deltaQty、amount は deltaYen を使う。
export type UsageEntry = {
  at: string; // ISO
  deltaQty?: number; // count: 負=使用 / 正=追加
  deltaYen?: number; // amount: 負=使用 / 正=チャージ
  note?: string;
};

export type BenefitItemV2 = {
  id: string;
  title: string; // 優待名
  company: string; // 企業名
  expiresOn: string | null; // YYYY-MM-DD or null(期限なし)
  isUsed: boolean; // remaining<=0 の派生（既存フィルタ互換のため保持）

  // 消費モデル（2026-05-20 decision-log）
  trackMode: TrackMode; // count=枚数 / amount=金額残高
  unitYen: number | null; // count: 1枚あたり額面 / amount: 未使用
  initial: number | null; // 初期値（基準）
  remaining: number | null; // count: 残枚数 / amount: 残円
  history: UsageEntry[];

  // 旧フィールド（legacy 入力としてのみ読む。今後は書かない）
  quantity?: number | null;
  amountYen?: number | null;
  memo?: string;
  link?: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// 2) constants
export const STORAGE_KEY_V2 = "mini-tools:benefits:v2";

const LEGACY_KEYS = [
  "benefits-tracker-items-v1",
  "benefits-tracker-items",
  "mini-tools:benefits",
];

export const STORAGE_EVENT = "mini-tools:benefits:v2:changed";

// 3) uuid helpers
export type CryptoWithUUID = Crypto & { randomUUID?: () => string };

export function safeUUID() {
  const c = globalThis.crypto as CryptoWithUUID | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// 4) legacy normalize helpers
function toNumberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return n;
}

// 数値/文字列(¥1,000 等)/混在を number|null に寄せる
export function coerceNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return toNumberOrNull(v.replace(/[^\d.-]/g, ""));
  return null;
}

// 期限を YYYY-MM-DD に正規化（2026/01/31・ISO・空 などを吸収）
function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // 区切りを - に寄せて先頭10文字を見る
  const head = s.replace(/[./]/g, "-").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

function normalizeHistory(v: unknown): UsageEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const at = typeof o.at === "string" && o.at ? o.at : null;
      if (!at) return null;
      const entry: UsageEntry = { at };
      const dq = coerceNumber(o.deltaQty);
      const dy = coerceNumber(o.deltaYen);
      if (dq != null) entry.deltaQty = dq;
      if (dy != null) entry.deltaYen = dy;
      if (typeof o.note === "string" && o.note) entry.note = o.note;
      return entry;
    })
    .filter(Boolean) as UsageEntry[];
}

// 旧 v1 / 旧 v2 / 新 v2 / エクスポート JSON を現行 BenefitItemV2 に寄せる。
// 新フィールドを優先し、無ければ legacy フィールドから移行する（冪等）。
export function coerceItem(x: unknown): BenefitItemV2 | null {
  if (!x || typeof x !== "object") return null;
  const obj = x as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id : safeUUID();
  const title = (typeof obj.title === "string" ? obj.title : "").trim();
  const company = (typeof obj.company === "string" ? obj.company : "").trim();

  // V2(expiresOn) 優先、旧 v1(expiresAt) フォールバック
  const expiresOn =
    normalizeDate(obj.expiresOn) ?? normalizeDate(obj.expiresAt);

  const wasUsed = obj.isUsed === true;

  // legacy 数値
  const legacyQty = coerceNumber(obj.quantity);
  const legacyAmount = coerceNumber(obj.amountYen) ?? coerceNumber(obj.amount);

  const trackMode: TrackMode = obj.trackMode === "amount" ? "amount" : "count";

  let unitYen: number | null;
  let initial: number | null;
  let remaining: number | null;

  if (trackMode === "amount") {
    unitYen = null;
    initial = coerceNumber(obj.initial) ?? legacyAmount ?? null;
    remaining =
      coerceNumber(obj.remaining) ?? (wasUsed ? 0 : initial);
  } else {
    unitYen = coerceNumber(obj.unitYen) ?? legacyAmount ?? null;
    // 単発クーポン（数量なし）は 1 個として扱う
    initial = coerceNumber(obj.initial) ?? legacyQty ?? (wasUsed ? 0 : 1);
    remaining =
      coerceNumber(obj.remaining) ?? (wasUsed ? 0 : initial);
  }

  if (remaining != null && remaining < 0) remaining = 0;
  const isUsed = remaining != null ? remaining <= 0 : wasUsed;

  const memo =
    typeof obj.memo === "string"
      ? obj.memo
      : typeof obj.note === "string"
      ? obj.note
      : "";

  const link =
    typeof obj.link === "string"
      ? obj.link
      : typeof obj.url === "string"
      ? obj.url
      : "";

  const createdAt =
    typeof obj.createdAt === "string" && obj.createdAt
      ? obj.createdAt
      : nowIso;
  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt
      ? obj.updatedAt
      : nowIso;

  return {
    id,
    title,
    company,
    expiresOn: expiresOn && expiresOn.trim() ? expiresOn.trim() : null,
    isUsed,
    trackMode,
    unitYen,
    initial,
    remaining,
    history: normalizeHistory(obj.history),
    memo: memo?.toString() ?? "",
    link: link.trim() ? link.trim() : undefined,
    createdAt,
    updatedAt,
  } satisfies BenefitItemV2;
}

export function normalizeLegacyToV2(raw: unknown): BenefitItemV2[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceItem).filter(Boolean) as BenefitItemV2[];
}

// ---- 消費モデル: 派生値と操作（純関数） ----

// 未使用相当の金額価値（count: 残数×額面 / amount: 残円）
export function itemValueYen(it: BenefitItemV2): number {
  const rem = it.remaining ?? 0;
  if (it.trackMode === "amount") return Math.max(0, rem);
  return Math.max(0, rem) * (it.unitYen ?? 0);
}

// 履歴の全デルタを符号付きで合計した「正味の使った金額」。
// 正デルタ（未使用に戻す / 追加 / チャージ）が負デルタを相殺するため、
// 「全部使う → 未使用に戻す」のような操作ミスは自動で打ち消される。
export function itemUsedYen(it: BenefitItemV2): number {
  const net = it.history.reduce((sum, e) => {
    const d =
      it.trackMode === "amount"
        ? e.deltaYen ?? 0
        : (e.deltaQty ?? 0) * (it.unitYen ?? 0);
    return sum + d;
  }, 0);
  return Math.max(0, -net);
}

function touch(it: BenefitItemV2, entry: UsageEntry): BenefitItemV2 {
  const nowIso = new Date().toISOString();
  const remaining =
    it.remaining == null ? it.remaining : Math.max(0, it.remaining);
  return {
    ...it,
    remaining,
    isUsed: remaining != null ? remaining <= 0 : it.isUsed,
    history: [...it.history, { ...entry, at: entry.at || nowIso }],
    updatedAt: nowIso,
  };
}

// 使う（amount は deltaYen、count は deltaQty）。残はマイナスにしない。
export function consume(
  it: BenefitItemV2,
  amount: number,
  note?: string
): BenefitItemV2 {
  if (!(amount > 0)) return it;
  const cur = it.remaining ?? 0;
  const used = Math.min(cur, amount);
  if (used <= 0) return it;
  const next: BenefitItemV2 = { ...it, remaining: cur - used };
  return touch(
    next,
    it.trackMode === "amount"
      ? { at: "", deltaYen: -used, note }
      : { at: "", deltaQty: -used, note }
  );
}

// 追加（補充 / チャージ）
export function restock(
  it: BenefitItemV2,
  amount: number,
  note?: string
): BenefitItemV2 {
  if (!(amount > 0)) return it;
  const next: BenefitItemV2 = { ...it, remaining: (it.remaining ?? 0) + amount };
  return touch(
    next,
    it.trackMode === "amount"
      ? { at: "", deltaYen: amount, note }
      : { at: "", deltaQty: amount, note }
  );
}

// 履歴の1件を削除し、残りの履歴を initial から再生して remaining を再計算する。
// 削除順に依存しないように差分の単純引き戻しではなく replay 方式を採る（codex review P2）。
export function removeHistoryEntry(
  it: BenefitItemV2,
  index: number
): BenefitItemV2 {
  if (index < 0 || index >= it.history.length) return it;
  const history = it.history
    .slice(0, index)
    .concat(it.history.slice(index + 1));
  const base = it.initial ?? 0;
  const sumDelta = history.reduce((sum, e) => {
    const d =
      it.trackMode === "amount" ? e.deltaYen ?? 0 : e.deltaQty ?? 0;
    return sum + d;
  }, 0);
  const remaining = Math.max(0, base + sumDelta);
  return {
    ...it,
    remaining,
    isUsed: remaining <= 0,
    history,
    updatedAt: new Date().toISOString(),
  };
}

// 使用済みトグル（全消費 / 復元）
export function setUsedAll(it: BenefitItemV2, used: boolean): BenefitItemV2 {
  if (used) {
    const cur = it.remaining ?? 0;
    if (cur <= 0) return { ...it, isUsed: true };
    return consume(it, cur, "全部使用");
  }
  const back = it.initial ?? 1;
  const next: BenefitItemV2 = { ...it, remaining: back };
  return touch(
    next,
    it.trackMode === "amount"
      ? { at: "", deltaYen: back - (it.remaining ?? 0), note: "未使用に戻す" }
      : { at: "", deltaQty: back - (it.remaining ?? 0), note: "未使用に戻す" }
  );
}

// 5) load/save (任意：今は未使用でもOK)
function loadFromLocalStorage(): BenefitItemV2[] {
  if (typeof window === "undefined") return [];

  // v2 があればそれを優先
  const v2 = window.localStorage.getItem(STORAGE_KEY_V2);
  if (v2) {
    try {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed)) return parsed as BenefitItemV2[];
    } catch {
      // ignore
    }
  }

  // v1/旧キーを探索して移行
  for (const k of LEGACY_KEYS) {
    const s = window.localStorage.getItem(k);
    if (!s) continue;
    try {
      const parsed = JSON.parse(s);
      const normalized = normalizeLegacyToV2(parsed);
      if (normalized.length) return normalized;
    } catch {
      // ignore
    }
  }

  return [];
}

function saveToLocalStorage(items: BenefitItemV2[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(items));
}

// 6) external store core
export const EMPTY_ITEMS: BenefitItemV2[] = [];
let cacheRaw: string | null = null;
let cacheParsed: BenefitItemV2[] = EMPTY_ITEMS;

export function subscribeBenefitsStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(STORAGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(STORAGE_EVENT, handler);
  };
}

// “変わってないなら同じ参照を返す” が超重要
export function getBenefitsSnapshot(): BenefitItemV2[] {
  if (typeof window === "undefined") return EMPTY_ITEMS;

  const raw = window.localStorage.getItem(STORAGE_KEY_V2) ?? "";
  if (raw === cacheRaw) return cacheParsed;

  cacheRaw = raw;
  if (!raw) {
    cacheParsed = EMPTY_ITEMS;
    return cacheParsed;
  }

  try {
    const parsed = JSON.parse(raw);
    // 旧 v2（消費フィールド無し）も読み込み時に移行して形を揃える
    cacheParsed = Array.isArray(parsed)
      ? (parsed.map(coerceItem).filter(Boolean) as BenefitItemV2[])
      : EMPTY_ITEMS;
  } catch {
    cacheParsed = EMPTY_ITEMS;
  }
  return cacheParsed;
}

export function getBenefitsServerSnapshot(): BenefitItemV2[] {
  // ここも “new []” にしない
  return EMPTY_ITEMS;
}

export function writeBenefits(next: BenefitItemV2[]) {
  if (typeof window === "undefined") return;
  // 保存（あなたの既存関数でもOK）
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(next));

  // キャッシュも更新して参照を安定させる
  cacheRaw = JSON.stringify(next);
  cacheParsed = next;

  window.dispatchEvent(new Event(STORAGE_EVENT));
}
