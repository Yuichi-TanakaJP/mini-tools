import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RankingManifest, RankingDayData } from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadRankingManifest, loadRankingDayData } from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE_MANIFEST: RankingManifest = {
  dates: ["2025-04-01", "2025-04-02"],
  latest: "2025-04-02",
};

const SAMPLE_DAY_DATA: RankingDayData = {
  date: "2025-04-02",
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

describe("loadRankingManifest", () => {
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

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のマニフェストを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MANIFEST));

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/ranking/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST) as never);

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST) as never);

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  // NOTE: loadLocalRankingManifest に try/catch がないため、
  // ローカルファイル欠損時は throw する（他ローダーと挙動が異なる）。
  // これは既知の設計差異であり、別 Issue で揃えるか検討する。
  it("API 設定あり・fetch 失敗かつローカルファイル欠損のとき throw する（既知の挙動）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    await expect(loadRankingManifest()).rejects.toThrow("ENOENT");
  });
});

describe("loadRankingDayData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき、ローカルファイルのデータを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_DAY_DATA));

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/ranking/2025-04-02",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA) as never);

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("ローカルファイルも存在しないとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toBeNull();
  });
});
