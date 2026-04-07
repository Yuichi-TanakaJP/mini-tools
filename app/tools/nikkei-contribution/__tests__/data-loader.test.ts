import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NikkeiContributionManifest, NikkeiContributionDayData } from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadContributionManifest, loadContributionDayData } from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE_MANIFEST: NikkeiContributionManifest = {
  dates: ["2025-04-01", "2025-04-02"],
  latest_date: "2025-04-02",
};

const SAMPLE_DAY_DATA: NikkeiContributionDayData = {
  date: "2025-04-02",
  index: "nikkei225",
  summary: { total_contribution: 100, advancers: 150, decliners: 60, unchanged: 15 },
  top_positive: [],
  top_negative: [],
  records: [],
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

describe("loadContributionManifest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき、ローカルファイルのマニフェストを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST) as never);

    const result = await loadContributionManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のマニフェストを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MANIFEST));

    const result = await loadContributionManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/nikkei/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST) as never);

    const result = await loadContributionManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST) as never);

    const result = await loadContributionManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("ローカルファイルも存在しないとき EMPTY_MANIFEST を返す（例外を throw しない）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadContributionManifest();

    expect(result).toEqual({ dates: [], latest_date: null });
  });
});

describe("loadContributionDayData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("空文字を渡したとき null を即返す（fetch しない）", async () => {
    const result = await loadContributionDayData("");

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 未設定のとき、ローカルファイルのデータを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadContributionDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_DAY_DATA));

    const result = await loadContributionDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/nikkei/2025-04-02",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadContributionDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadContributionDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("ローカルファイルも存在しないとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadContributionDayData("2025-04-02");

    expect(result).toBeNull();
  });
});
