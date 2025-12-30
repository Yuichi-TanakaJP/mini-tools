// app/tools/yutai-expiry/benefits/store.ts

// 1) types
export type BenefitItemV2 = {
  id: string;
  title: string; // 優待名
  company: string; // 企業名
  expiresOn: string | null; // YYYY-MM-DD or null(期限なし)
  isUsed: boolean;

  // 任意（ユーザーの要望：隠さない、任意）
  quantity?: number | null;
  amountYen?: number | null;
  memo?: string;

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

export function normalizeLegacyToV2(raw: unknown): BenefitItemV2[] {
  if (!Array.isArray(raw)) return [];

  const nowIso = new Date().toISOString();

  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const obj = x as Record<string, unknown>;

      const id =
        typeof obj.id === "string" && obj.id.trim() ? obj.id : safeUUID();

      const title = typeof obj.title === "string" ? obj.title : "";
      const company = typeof obj.company === "string" ? obj.company : "";

      const expiresAt =
        typeof obj.expiresAt === "string" ? obj.expiresAt : null;
      // expiresAt が ISO の日付だったりするケースもあるので YYYY-MM-DD に寄せる
      const expiresOn = expiresAt ? expiresAt.slice(0, 10) : null;

      const isUsed = typeof obj.isUsed === "boolean" ? obj.isUsed : false;

      const quantity = (() => {
        if (typeof obj.quantity === "number") return obj.quantity;
        if (typeof obj.quantity === "string")
          return toNumberOrNull(obj.quantity);
        return null;
      })();

      const amountYen = (() => {
        if (typeof obj.amount === "number") return obj.amount;
        if (typeof obj.amount === "string") return toNumberOrNull(obj.amount);
        // v1で amount が "¥1,000" みたいに入ってる可能性を拾う
        if (typeof obj.amount === "string") {
          const cleaned = obj.amount.replace(/[^\d.-]/g, "");
          return toNumberOrNull(cleaned);
        }
        return null;
      })();

      const memo =
        typeof obj.note === "string"
          ? obj.note
          : typeof obj.memo === "string"
          ? obj.memo
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
        title: title.trim(),
        company: company.trim(),
        expiresOn: expiresOn && expiresOn.trim() ? expiresOn.trim() : null,
        isUsed,
        quantity: quantity ?? null,
        amountYen: amountYen ?? null,
        memo: memo?.toString() ?? "",
        createdAt,
        updatedAt,
      } satisfies BenefitItemV2;
    })
    .filter(Boolean) as BenefitItemV2[];
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
    cacheParsed = Array.isArray(parsed) ? parsed : EMPTY_ITEMS;
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
  // 保存（あなたの既存関数でもOK）
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(next));

  // キャッシュも更新して参照を安定させる
  cacheRaw = JSON.stringify(next);
  cacheParsed = next;

  window.dispatchEvent(new Event(STORAGE_EVENT));
}
