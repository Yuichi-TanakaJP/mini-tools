import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NikkoShortBalanceData } from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadNikkoShortBalance } from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE: NikkoShortBalanceData = {
  asOf: "2026-06-02",
  byCode: { "7203": { sellBalance: 1234500 } },
};

function makeFetchOk(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function makeFetch500(): Response {
  return { ok: false, status: 500 } as unknown as Response;
}

describe("loadNikkoShortBalance", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    process.env.NODE_ENV = "test";
    delete process.env.MARKET_INFO_API_BASE_URL;
    delete process.env.MINI_TOOLS_ENABLE_LOCAL_DATA_FALLBACK;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき、ローカルサンプルを返す（fetch しない）", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE));

    const result = await loadNikkoShortBalance();

    expect(result).toEqual(SAMPLE);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 未設定・サンプルも無いとき、空表を返す", async () => {
    mockReadFile.mockRejectedValue(new Error("not found"));

    const result = await loadNikkoShortBalance();

    expect(result).toEqual({ asOf: null, byCode: {} });
  });

  it("API 設定あり・正常レスポンスのとき、API の値を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE));

    const result = await loadNikkoShortBalance();

    expect(result).toEqual(SAMPLE);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/nikko/short-balance",
      expect.anything(),
    );
  });

  it("API 設定あり・fetch 失敗のとき、サンプルにフォールバックせず空表を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch500());

    const result = await loadNikkoShortBalance();

    expect(result).toEqual({ asOf: null, byCode: {} });
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
