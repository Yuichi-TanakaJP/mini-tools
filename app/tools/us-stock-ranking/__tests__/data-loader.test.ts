import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsRankingDayData, UsRankingManifest } from "../types";
import { loadUsRankingDayData, loadUsRankingManifest } from "../data-loader";

const SAMPLE_MANIFEST: UsRankingManifest = {
  dates: ["2025-04-11", "2025-04-10"],
  latest: "2025-04-11",
};

const SAMPLE_DAY_DATA: UsRankingDayData = {
  date: "2025-04-11",
  records: [
    {
      exchange: "US",
      ranking: "値上り率",
      rank: 1,
      ticker: "AAPL",
      listingExchange: "NASDAQ",
      handlingFlag: "1",
      name: "アップル",
      nameEn: "Apple Inc.",
      price: 198.76,
      time: "2025-04-11T16:00:00-04:00",
      change: 4.12,
      changeRate: 2.12,
      volume: 123456,
      tradedValue: 789012,
      per: 31.4,
      pbr: 45.2,
    },
  ],
};

function makeFetchOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

function makeFetch404(): Response {
  return { ok: false, status: 404 } as unknown as Response;
}

describe("loadUsRankingManifest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき null を返す", async () => {
    const result = await loadUsRankingManifest();

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のマニフェストを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MANIFEST));

    const result = await loadUsRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/us-ranking/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());

    const result = await loadUsRankingManifest();

    expect(result).toBeNull();
  });

  it("API 設定あり・timeout のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));

    const result = await loadUsRankingManifest();

    expect(result).toBeNull();
  });

  it("API 設定あり・network error のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await loadUsRankingManifest();

    expect(result).toBeNull();
  });
});

describe("loadUsRankingDayData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき null を返す", async () => {
    const result = await loadUsRankingDayData("2025-04-11");

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_DAY_DATA));

    const result = await loadUsRankingDayData("2025-04-11");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/us-ranking/2025-04-11",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());

    const result = await loadUsRankingDayData("2025-04-11");

    expect(result).toBeNull();
  });

  it("API 設定あり・timeout のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));

    const result = await loadUsRankingDayData("2025-04-11");

    expect(result).toBeNull();
  });

  it("API 設定あり・network error のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await loadUsRankingDayData("2025-04-11");

    expect(result).toBeNull();
  });
});
