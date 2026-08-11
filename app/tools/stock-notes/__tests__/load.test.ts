import { describe, expect, it } from "vitest";
import { HoldingsFetchError } from "../data";
import { loadDashboardData } from "../load";

const emptyEarnings = {
  asOfDate: "2026-08-11",
  windowTo: "2026-09-30",
  earnings: {},
  lastEarnings: {},
  complete: true,
  missingMonths: [] as string[],
};

const emptyOkFetchers = {
  fetchStocks: async () => [],
  fetchAnalyses: async () => [],
  fetchTheses: async () => [],
  fetchOpenActions: async () => [],
  fetchHoldings: async () => ({ holdings: [], updatedAt: null }),
  fetchEarnings: async (_codes: string[]) => emptyEarnings,
};

describe("loadDashboardData", () => {
  it("全部成功したら status: ok で結果を返す", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchHoldings: async () => ({
        holdings: [
          { id: "a", code: "7203", name: "トヨタ自動車", market: "", sector: null, tab: "holding", addedAt: 1, updatedAt: 1 },
        ],
        updatedAt: "2026-06-21T00:00:00.000Z",
      }),
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.holdings).toHaveLength(1);
      expect(result.holdingsUpdatedAt).toBe("2026-06-21T00:00:00.000Z");
      expect(result.earnings).toEqual(emptyEarnings);
    }
  });

  it("stocks + holdings のコード集合を fetchEarnings に渡す（重複は除く）", async () => {
    const receivedCodes: string[][] = [];
    await loadDashboardData({
      ...emptyOkFetchers,
      fetchStocks: async () => [
        { id: "s1", code: "7203", name: "トヨタ自動車", category: "holding", categoryChangedAt: null, categoryChangeReason: null, createdAt: "", updatedAt: "" },
        { id: "s2", code: "6758", name: "ソニーグループ", category: "watch", categoryChangedAt: null, categoryChangeReason: null, createdAt: "", updatedAt: "" },
      ],
      fetchHoldings: async () => ({
        holdings: [
          { id: "a", code: "7203", name: "トヨタ自動車", market: "", sector: null, tab: "holding", addedAt: 1, updatedAt: 1 },
          { id: "b", code: "9999", name: "重複しない銘柄", market: "", sector: null, tab: "holding", addedAt: 1, updatedAt: 1 },
        ],
        updatedAt: null,
      }),
      fetchEarnings: async (codes: string[]) => {
        receivedCodes.push(codes);
        return emptyEarnings;
      },
    });
    expect(receivedCodes).toHaveLength(1);
    expect(new Set(receivedCodes[0])).toEqual(new Set(["7203", "6758", "9999"]));
  });

  it("対象銘柄コードが0件なら fetchEarnings を呼ばず earnings は null", async () => {
    let called = false;
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchEarnings: async (codes: string[]) => {
        called = true;
        return { ...emptyEarnings };
      },
    });
    expect(called).toBe(false);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.earnings).toBeNull();
    }
  });

  it("保有リストの取得が401で失敗したら status: unauthorized（一般エラーと区別する）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchHoldings: async () => {
        throw new HoldingsFetchError(401, "unauthorized");
      },
    });
    expect(result.status).toBe("unauthorized");
    if (result.status === "unauthorized") {
      expect(result.message).toContain("ログインし直して");
    }
  });

  it("保有リストの取得が401以外で失敗したら status: error", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchHoldings: async () => {
        throw new HoldingsFetchError(500, "boom");
      },
    });
    expect(result.status).toBe("error");
  });

  it("stock_notes 側のテーブル取得が失敗しても status: error（保有0件として握りつぶさない）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchStocks: async () => {
        throw new Error("network error");
      },
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("network error");
    }
  });

  it("stock_notes側のSupabase取得がセッション切れ相当のエラー（PGRST301）で失敗したらstatus: unauthorized（/api/syncの401と同じ扱いにする）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchStocks: async () => {
        throw { code: "PGRST301", message: "JWT expired" };
      },
    });
    expect(result.status).toBe("unauthorized");
    if (result.status === "unauthorized") {
      expect(result.message).toContain("ログインし直して");
    }
  });

  it("stock_notes側のSupabase取得が単なる権限エラー（42501等）ではstatus: error（セッション切れと混同しない）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchStocks: async () => {
        throw { code: "42501", message: "permission denied" };
      },
    });
    expect(result.status).toBe("error");
  });

  it("決算日の取得が失敗しても status: ok のまま、earningsだけnullになる（ページ全体を失敗させない）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchHoldings: async () => ({
        holdings: [
          { id: "a", code: "7203", name: "トヨタ自動車", market: "", sector: null, tab: "holding", addedAt: 1, updatedAt: 1 },
        ],
        updatedAt: null,
      }),
      fetchEarnings: async (_codes: string[]) => {
        throw new Error("upstream down");
      },
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.earnings).toBeNull();
    }
  });
});
