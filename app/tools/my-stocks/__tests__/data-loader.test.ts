import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMyStocksReference } from "../data-loader";

function makeFetchOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

describe("my-stocks data-loader", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com/";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  it("stock-master latest から基盤情報 map を作る", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchOk([
        {
          code: "7203",
          name: "トヨタＡＢＣ１２３",
          display_name: "トヨタＡＢＣ１２３",
          abbrev_name: "トヨタ",
          market: "プライム",
          sector: "輸送用機器",
          earnings_next_date: "2026-06-10",
          yutai_months: "3,9",
          dividend_yield_pct: 2.5,
          dividend_per_share: 117,
          dividend_as_of: "2026-06-07",
          as_of_date: "2026-06-08",
        },
        {
          code: "1301",
          name: "極洋",
          display_name: "極洋",
          abbrev_name: "極洋",
          market: "プライム",
          sector: "水産・農林業",
          earnings_next_date: null,
          yutai_months: null,
          dividend_yield_pct: null,
          dividend_per_share: null,
          dividend_as_of: null,
          as_of_date: "2026-06-08",
        },
      ]),
    );

    const result = await loadMyStocksReference();

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/stock-master/latest",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        cache: "no-store",
      }),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ next: expect.anything() }),
    );
    expect(result.asOf).toBe("2026-06-08");
    expect(result.nextEarningsByCode).toEqual({ "7203": "2026-06-10" });
    expect(result.yutaiMonthsByCode).toEqual({ "7203": [3, 9] });
    expect(result.dividendByCode).toEqual({
      "7203": { yieldPct: 2.5, perShare: 117, asOf: "2026-06-07" },
    });
    expect(result.stockMaster).toEqual([
      {
        code: "7203",
        name: "トヨタABC123",
        market: "プライム",
        sector: "輸送用機器",
        dividend: { yieldPct: 2.5, perShare: 117, asOf: "2026-06-07" },
      },
      {
        code: "1301",
        name: "極洋",
        market: "プライム",
        sector: "水産・農林業",
      },
    ]);
  });
});
