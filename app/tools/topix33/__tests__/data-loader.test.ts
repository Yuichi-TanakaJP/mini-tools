import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Topix33Manifest, Topix33DayData } from "../types";

// node:fs/promises をモック（import より前に宣言が必要）
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadTopix33Manifest, loadTopix33DayData } from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE_MANIFEST: Topix33Manifest = {
  dates: ["2025-04-01", "2025-04-02"],
  latest_date: "2025-04-02",
};

const SAMPLE_DAY_DATA: Topix33DayData = {
  date: "2025-04-02",
  index: "topix33",
  summary: { advancers: 20, decliners: 10, unchanged: 3 },
  top_positive: [],
  top_negative: [],
  sectors: [],
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

describe("loadTopix33Manifest", () => {
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

    const result = await loadTopix33Manifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のマニフェストを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_MANIFEST));

    const result = await loadTopix33Manifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/topix33/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadTopix33Manifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_MANIFEST));

    const result = await loadTopix33Manifest();

    expect(result).toEqual(SAMPLE_MANIFEST);
  });

  it("ローカルファイルも存在しないとき EMPTY_MANIFEST を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadTopix33Manifest();

    expect(result).toEqual({ dates: [], latest_date: null });
  });
});

describe("loadTopix33DayData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("空文字を渡したとき null を即返す（fetch しない）", async () => {
    const result = await loadTopix33DayData("");

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 未設定のとき、ローカルファイルのデータを返す", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

    const result = await loadTopix33DayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・正常レスポンスのとき、API のデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetchOk(SAMPLE_DAY_DATA));

    const result = await loadTopix33DayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/topix33/2025-04-02",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("API 設定あり・404 のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockResolvedValue(makeFetch404());
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

    const result = await loadTopix33DayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("API 設定あり・timeout のとき、ローカル fallback を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));
    mockReadFile.mockResolvedValue(JSON.stringify(SAMPLE_DAY_DATA));

    const result = await loadTopix33DayData("2025-04-02");

    expect(result).toEqual(SAMPLE_DAY_DATA);
  });

  it("ローカルファイルも存在しないとき null を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await loadTopix33DayData("2025-04-02");

    expect(result).toBeNull();
  });
});
