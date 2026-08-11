import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_TTL_MS,
  invalidateStockNotesCache,
  readStockNotesCache,
  writeStockNotesCache,
  type CachedStockNotesData,
} from "../cache";

/**
 * このリポジトリの vitest は environment: "node" のため window/localStorage が無い。
 * cache.ts は `typeof window === "undefined"` を見て SSR / 未対応環境をガードしているので、
 * テストでは最小限の localStorage 実装を window として stub する。
 */
function makeMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const emptyData: CachedStockNotesData = {
  stocks: [],
  analyses: [],
  theses: [],
  actions: [],
  holdings: [],
  holdingsUpdatedAt: null,
  earnings: null,
};

describe("stock-notes cache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: makeMemoryLocalStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("書いた直後は同じ userId で読める", () => {
    const now = Date.now();
    writeStockNotesCache("user-1", { ...emptyData, stocks: [{ id: "s1" } as never] }, now);
    const result = readStockNotesCache("user-1", now + 1000);
    expect(result).not.toBeNull();
    expect(result?.data.stocks).toHaveLength(1);
    expect(result?.fetchedAt).toBe(new Date(now).toISOString());
  });

  it("別の userId では読めない（別アカウントのデータ混入防止）", () => {
    const now = Date.now();
    writeStockNotesCache("user-1", emptyData, now);
    expect(readStockNotesCache("user-2", now + 1000)).toBeNull();
  });

  it("TTL（15分）以内なら読める", () => {
    const now = Date.now();
    writeStockNotesCache("user-1", emptyData, now);
    const result = readStockNotesCache("user-1", now + CACHE_TTL_MS - 1);
    expect(result).not.toBeNull();
  });

  it("TTL（15分）を超えると読めない", () => {
    const now = Date.now();
    writeStockNotesCache("user-1", emptyData, now);
    const result = readStockNotesCache("user-1", now + CACHE_TTL_MS + 1);
    expect(result).toBeNull();
  });

  it("壊れたJSONは例外を投げずnullを返す", () => {
    (window as unknown as { localStorage: Storage }).localStorage.setItem(
      "stock_notes_dashboard_cache_v1_user-1",
      "{not valid json",
    );
    expect(() => readStockNotesCache("user-1")).not.toThrow();
    expect(readStockNotesCache("user-1")).toBeNull();
  });

  it("バージョン不一致は読めない（スキーマ変更後の古いキャッシュを無効化する）", () => {
    const now = Date.now();
    const raw = JSON.stringify({
      version: 999,
      userId: "user-1",
      fetchedAt: new Date(now).toISOString(),
      data: emptyData,
    });
    (window as unknown as { localStorage: Storage }).localStorage.setItem(
      "stock_notes_dashboard_cache_v1_user-1",
      raw,
    );
    expect(readStockNotesCache("user-1", now + 1000)).toBeNull();
  });

  it("形が壊れている（配列であるべきフィールドが配列でない）場合は読めない", () => {
    const now = Date.now();
    const raw = JSON.stringify({
      version: 1,
      userId: "user-1",
      fetchedAt: new Date(now).toISOString(),
      data: { ...emptyData, stocks: "not-an-array" },
    });
    (window as unknown as { localStorage: Storage }).localStorage.setItem(
      "stock_notes_dashboard_cache_v1_user-1",
      raw,
    );
    expect(readStockNotesCache("user-1", now + 1000)).toBeNull();
  });

  it("localStorage が無い環境（window undefined）では例外を投げずnullを返す", () => {
    vi.unstubAllGlobals();
    expect(() => readStockNotesCache("user-1")).not.toThrow();
    expect(readStockNotesCache("user-1")).toBeNull();
  });

  it("localStorage.setItem が例外を投げても writeStockNotesCache は握りつぶす（容量超過等）", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
      },
    });
    expect(() => writeStockNotesCache("user-1", emptyData)).not.toThrow();
  });

  it("invalidateStockNotesCache でキャッシュを削除できる", () => {
    const now = Date.now();
    writeStockNotesCache("user-1", emptyData, now);
    expect(readStockNotesCache("user-1", now + 1000)).not.toBeNull();
    invalidateStockNotesCache("user-1");
    expect(readStockNotesCache("user-1", now + 1000)).toBeNull();
  });

  it("invalidateStockNotesCache は localStorage.removeItem が例外を投げても握りつぶす", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {
          throw new Error("boom");
        },
      },
    });
    expect(() => invalidateStockNotesCache("user-1")).not.toThrow();
  });
});
