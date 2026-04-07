import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  MonthlyYutaiManifest,
  MonthlyYutaiMonthData,
  NikkoCreditData,
  SbiCreditData,
} from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import {
  loadMonthlyYutaiManifest,
  loadMonthlyYutaiMonthData,
  loadMonthlyYutaiPageData,
} from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE_MANIFEST: MonthlyYutaiManifest = {
  version: 1,
  generated_at: "2025-04-01T00:00:00Z",
  source: "minkabu",
  latest_month: "2025-04",
  latest_path: "2025-04.json",
  months: [{ year: 2025, month: 4, path: "2025-04.json", count: 10 }],
};

const SAMPLE_MONTH_DATA: MonthlyYutaiMonthData = {
  year: 2025,
  month: 4,
  generated_at: "2025-04-01T00:00:00Z",
  source: "minkabu",
  records: [],
};

const SAMPLE_NIKKO_CREDIT: NikkoCreditData = {
  date: "2025-04-01",
  generated_at: "2025-04-01T00:00:00Z",
  record_count: 0,
  by_code: {},
};

const SAMPLE_SBI_CREDIT: SbiCreditData = {
  date: "2025-04-01",
  generated_at: "2025-04-01T00:00:00Z",
  record_count: 0,
  by_code: {},
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

describe("loadMonthlyYutaiManifest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき、ローカルファイルのマニフェストを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadMonthlyYutaiManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のマニフェストを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MANIFEST));

    const result = await loadMonthlyYutaiManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/yutai/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadMonthlyYutaiManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadMonthlyYutaiManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("ローカルファイルも存在しないとき null を返す（例外を throw しない）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadMonthlyYutaiManifest();

    expect(result).toBeNull();
  });
});

describe("loadMonthlyYutaiMonthData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき、ローカルファイルの月次データを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MONTH_DATA));

    const result = await loadMonthlyYutaiMonthData("2025-04");

    expect(result).toEqual(SAMPLE_MONTH_DATA);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MONTH_DATA));

    const result = await loadMonthlyYutaiMonthData("2025-04");

    expect(result).toEqual(SAMPLE_MONTH_DATA);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/yutai/monthly/2025-04",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MONTH_DATA));

    const result = await loadMonthlyYutaiMonthData("2025-04");

    expect(result).toEqual(SAMPLE_MONTH_DATA);
  });

  it("ローカルファイルも存在しないとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadMonthlyYutaiMonthData("2025-04");

    expect(result).toBeNull();
  });
});

describe("nikko/SBI credit: API あり・fetch 失敗時はサンプルを返さない", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  it("API 未設定のとき nikkoCredit にサンプルデータが入る", async () => {
    delete process.env.MARKET_INFO_API_BASE_URL;
    // manifest はローカルから
    mockReadFile.mockImplementation(async (filePath) => {
      const p = String(filePath);
      if (p.includes("manifest.json")) return JSON.stringify(SAMPLE_MANIFEST);
      if (p.includes("2025-04.json")) return JSON.stringify(SAMPLE_MONTH_DATA);
      if (p.includes("nikko_credit_sample.json")) return JSON.stringify(SAMPLE_NIKKO_CREDIT);
      if (p.includes("sbi_credit_sample.json")) return JSON.stringify(SAMPLE_SBI_CREDIT);
      throw new Error("ENOENT: " + p);
    });

    const result = await loadMonthlyYutaiPageData("2025-04");

    expect(result.nikkoCredit).toEqual(SAMPLE_NIKKO_CREDIT);
  });

  it("API 設定あり・nikko credit fetch 失敗のとき nikkoCredit は null（サンプルを返さない）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/yutai/manifest")) return makeFetchOk(SAMPLE_MANIFEST);
      if (u.includes("/yutai/monthly/")) return makeFetchOk(SAMPLE_MONTH_DATA);
      if (u.includes("/nikko/credit")) return makeFetch404();
      if (u.includes("/sbi/credit")) return makeFetch404();
      return makeFetch404();
    });

    const result = await loadMonthlyYutaiPageData("2025-04");

    expect(result.nikkoCredit).toBeNull();
  });

  it("API 設定あり・SBI credit fetch 失敗のとき sbiCredit は null（サンプルを返さない）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/yutai/manifest")) return makeFetchOk(SAMPLE_MANIFEST);
      if (u.includes("/yutai/monthly/")) return makeFetchOk(SAMPLE_MONTH_DATA);
      if (u.includes("/nikko/credit")) return makeFetch404();
      if (u.includes("/sbi/credit")) return makeFetch404();
      return makeFetch404();
    });

    const result = await loadMonthlyYutaiPageData("2025-04");

    expect(result.sbiCredit).toBeNull();
  });
});

describe("loadMonthlyYutaiPageData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  it("全ソース正常のとき MonthlyYutaiPageData を正しく組み立てる", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/yutai/manifest")) return makeFetchOk(SAMPLE_MANIFEST);
      if (u.includes("/yutai/monthly/")) return makeFetchOk(SAMPLE_MONTH_DATA);
      if (u.includes("/nikko/credit")) return makeFetchOk(SAMPLE_NIKKO_CREDIT);
      if (u.includes("/sbi/credit")) return makeFetchOk(SAMPLE_SBI_CREDIT);
      return makeFetch404();
    });

    const result = await loadMonthlyYutaiPageData("2025-04");

    expect(result.manifest).toEqual(SAMPLE_MANIFEST);
    expect(result.selectedMonthId).toBe("2025-04");
    expect(result.items).toEqual([]);
    expect(result.nikkoCredit).toEqual(SAMPLE_NIKKO_CREDIT);
    expect(result.sbiCredit).toEqual(SAMPLE_SBI_CREDIT);
  });

  it("一部ソースが null でも PageData を返す（例外を throw しない）", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/yutai/manifest")) return makeFetchOk(SAMPLE_MANIFEST);
      if (u.includes("/yutai/monthly/")) return makeFetch404();
      if (u.includes("/nikko/credit")) return makeFetch404();
      if (u.includes("/sbi/credit")) return makeFetch404();
      return makeFetch404();
    });
    // month data も sbi も fallback なしで null
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadMonthlyYutaiPageData("2025-04");

    expect(result).toBeDefined();
    expect(result.nikkoCredit).toBeNull();
    expect(result.sbiCredit).toBeNull();
    expect(result.items).toEqual([]);
  });

  it("過去月を選択したとき SBI credit は monthly エンドポイントを呼ぶ", async () => {
    const pastMonth = "2024-01";
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/yutai/manifest")) {
        const pastManifest: MonthlyYutaiManifest = {
          ...SAMPLE_MANIFEST,
          latest_month: pastMonth,
          months: [{ year: 2024, month: 1, path: "2024-01.json", count: 5 }],
        };
        return makeFetchOk(pastManifest);
      }
      if (u.includes("/yutai/monthly/")) return makeFetchOk(SAMPLE_MONTH_DATA);
      if (u.includes("/nikko/credit")) return makeFetchOk(SAMPLE_NIKKO_CREDIT);
      if (u.includes("/sbi/credit/monthly/")) return makeFetchOk(SAMPLE_SBI_CREDIT);
      return makeFetch404();
    });

    await loadMonthlyYutaiPageData(pastMonth);

    const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(calls.some((u) => u.includes("/sbi/credit/monthly/2024-01"))).toBe(true);
    expect(calls.every((u) => !u.includes("/sbi/credit/latest"))).toBe(true);
  });
});
