import { describe, expect, it } from "vitest";
import { HoldingsFetchError } from "../data";
import { loadDashboardData } from "../load";

const emptyEarnings = { asOfDate: "2026-08-11", windowTo: "2026-09-30", earnings: {}, lastEarnings: {} };

const emptyOkFetchers = {
  fetchStocks: async () => [],
  fetchAnalyses: async () => [],
  fetchTheses: async () => [],
  fetchOpenActions: async () => [],
  fetchHoldings: async () => ({ holdings: [], updatedAt: null }),
  fetchEarnings: async () => emptyEarnings,
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

  it("決算日の取得が失敗しても status: ok のまま、earningsだけnullになる（ページ全体を失敗させない）", async () => {
    const result = await loadDashboardData({
      ...emptyOkFetchers,
      fetchEarnings: async () => {
        throw new Error("upstream down");
      },
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.earnings).toBeNull();
    }
  });
});
