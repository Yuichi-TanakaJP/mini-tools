import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadRankingManifest, loadRankingDayData } from "../data-loader";
import { SAMPLE_DAY_DATA, SAMPLE_MANIFEST } from "./fixtures";

const mockReadFile = vi.mocked(readFile);

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
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

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
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadRankingManifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・fetch 失敗かつローカルファイル欠損のとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const error = new Error("ENOENT") as Error & { code?: string };
    error.code = "ENOENT";
    mockReadFile.mockRejectedValue(error);

    const result = await loadRankingManifest();

    expect(result).toBeNull();
  });

  it("API 未設定かつローカルファイル欠損のとき null を返す", async () => {
    const error = new Error("ENOENT") as Error & { code?: string };
    error.code = "ENOENT";
    mockReadFile.mockRejectedValue(error);

    const result = await loadRankingManifest();

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ローカル manifest が壊れているときは throw する", async () => {
    mockReadFile.mockResolvedValue("{invalid json");

    await expect(loadRankingManifest()).rejects.toThrow();
  });

  it("API 設定あり・fetch 失敗かつローカル権限エラーのとき throw する", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const error = new Error("EACCES") as Error & { code?: string };
    error.code = "EACCES";
    mockReadFile.mockRejectedValue(error);

    await expect(loadRankingManifest()).rejects.toThrow("EACCES");
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
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

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
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

    const result = await loadRankingDayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

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
