import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JpxMarketClosedResponse } from "@/app/tools/_shared/market-calendar-types";
import type {
  EarningsCalendarManifest,
  EarningsCalendarResponse,
  OverseasEarningsCalendarResponse,
} from "../types";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { loadEarningsCalendarPageData } from "../data-loader";

const mockReadFile = vi.mocked(readFile);

const SAMPLE_DOMESTIC_MANIFEST: EarningsCalendarManifest = {
  as_of_date: "2025-04-01",
  current_window: { from: "2025-04-01", to: "2025-04-30" },
  months: [
    {
      id: "2025-04",
      year: 2025,
      month: 4,
      path: "2025-04.json",
      partial: false,
      bucket: "current",
    },
  ],
};

const SAMPLE_DOMESTIC_MONTH_DATA: EarningsCalendarResponse = {
  as_of_date: "2025-04-01",
  calendar: [
    {
      date: "2025-04-01",
      count: 2,
      detail_status: "present",
      items: [
        {
          time: "15:00",
          code: "7203",
          name: "トヨタ自動車",
          market: "プライム",
          announcement_type: "本決算",
          publish_status: "発表",
          progress_status: "",
        },
      ],
    },
  ],
};

const SAMPLE_DOMESTIC_LATEST: EarningsCalendarResponse = {
  as_of_date: "2025-04-02",
  calendar: [],
};

const SAMPLE_HOLIDAYS: JpxMarketClosedResponse = {
  as_of_date: "2025-01-01",
  from: "2026-01-01",
  to: "2027-12-31",
  days: [],
};

const SAMPLE_OVERSEAS_MANIFEST: EarningsCalendarManifest = {
  as_of_date: "2025-04-01",
  current_window: { from: "2025-04-01", to: "2025-04-30" },
  months: [
    {
      id: "2025-04",
      year: 2025,
      month: 4,
      path: "2025-04.json",
      partial: false,
      bucket: "current",
    },
  ],
};

const SAMPLE_OVERSEAS_RAW: OverseasEarningsCalendarResponse = {
  as_of_date: "2025-04-01",
  calendar: [
    {
      date: "2025-04-01",
      count: 1,
      detail_status: "present",
      items: [
        {
          event_id: "ev001",
          local_time: "08:00",
          ticker: "AAPL",
          stock_name: "Apple Inc.",
          exchange_code: "NASDAQ",
          fiscal_term_name: "Q2 2025",
          fiscal_term: "Q2",
          sch_flg: "1",
          country_code: "US",
        },
      ],
    },
  ],
};

function makeLocalFiles() {
  mockReadFile.mockImplementation(async (filePath) => {
    const p = String(filePath);
    if (p.endsWith("latest.json")) return JSON.stringify(SAMPLE_DOMESTIC_LATEST);
    if (p.endsWith("manifest.json")) return JSON.stringify(SAMPLE_DOMESTIC_MANIFEST);
    if (p.endsWith("2025-04.json")) return JSON.stringify(SAMPLE_DOMESTIC_MONTH_DATA);
    if (p.includes("jpx_market_closed")) return JSON.stringify(SAMPLE_HOLIDAYS);
    throw new Error("ENOENT: " + p);
  });
}

function makeFetchOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

function makeFetch404(): Response {
  return { ok: false, status: 404 } as unknown as Response;
}

describe("loadEarningsCalendarPageData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき domestic はローカルファイルから取得する（fetch しない）", async () => {
    makeLocalFiles();

    const result = await loadEarningsCalendarPageData();

    expect(result.domestic.manifest).toEqual(SAMPLE_DOMESTIC_MANIFEST);
    expect(result.domestic.monthData["2025-04"]).toEqual(SAMPLE_DOMESTIC_MONTH_DATA);
    expect(result.domestic.latest).toEqual(SAMPLE_DOMESTIC_LATEST);
    expect(result.domestic.holidays).toEqual(SAMPLE_HOLIDAYS);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・domestic manifest 正常のとき API からデータを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/earnings-calendar/domestic/manifest")) return makeFetchOk(SAMPLE_DOMESTIC_MANIFEST);
      if (u.includes("/earnings-calendar/domestic/latest")) return makeFetchOk(SAMPLE_DOMESTIC_LATEST);
      if (u.includes("/earnings-calendar/domestic/monthly/")) return makeFetchOk(SAMPLE_DOMESTIC_MONTH_DATA);
      if (u.includes("/earnings-calendar/overseas/")) return makeFetch404();
      return makeFetch404();
    });

    const result = await loadEarningsCalendarPageData();

    expect(result.domestic.manifest).toEqual(SAMPLE_DOMESTIC_MANIFEST);
    expect(result.domestic.monthData["2025-04"]).toEqual(SAMPLE_DOMESTIC_MONTH_DATA);
    expect(result.domestic.latest).toEqual(SAMPLE_DOMESTIC_LATEST);
  });

  it("API 設定あり・domestic manifest 失敗のときローカル JSON にフォールバックする", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/earnings-calendar/domestic/")) return makeFetch404();
      if (u.includes("/earnings-calendar/overseas/")) return makeFetch404();
      return makeFetch404();
    });

    const result = await loadEarningsCalendarPageData();

    expect(result.domestic.manifest).toEqual(SAMPLE_DOMESTIC_MANIFEST);
    expect(result.domestic.monthData["2025-04"]).toEqual(SAMPLE_DOMESTIC_MONTH_DATA);
  });

  it("API 未設定のとき overseas は空構造を返す（fetch しない）", async () => {
    makeLocalFiles();

    const result = await loadEarningsCalendarPageData();

    expect(result.overseas.manifest).toBeNull();
    expect(result.overseas.monthData).toEqual({});
    expect(result.overseas.latest).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API 設定あり・overseas 正常のとき overseas データを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/earnings-calendar/overseas/manifest")) return makeFetchOk(SAMPLE_OVERSEAS_MANIFEST);
      if (u.includes("/earnings-calendar/overseas/latest")) return makeFetchOk(SAMPLE_OVERSEAS_RAW);
      if (u.includes("/earnings-calendar/overseas/monthly/")) return makeFetchOk(SAMPLE_OVERSEAS_RAW);
      return makeFetch404();
    });

    const result = await loadEarningsCalendarPageData();

    expect(result.overseas.manifest).toEqual(SAMPLE_OVERSEAS_MANIFEST);
    expect(result.overseas.latest).not.toBeNull();
  });

  it("overseas manifest 取得失敗のとき、overseas は空構造を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockResolvedValue(makeFetch404());

    const result = await loadEarningsCalendarPageData();

    expect(result.overseas.manifest).toBeNull();
    expect(result.overseas.monthData).toEqual({});
  });

  it("overseas API timeout のとき、overseas は空構造を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockRejectedValue(new DOMException("AbortError", "AbortError"));

    const result = await loadEarningsCalendarPageData();

    expect(result.overseas.manifest).toBeNull();
    expect(result.overseas.monthData).toEqual({});
  });

  it("OverseasEarningsCalendarItem を EarningsCalendarItem へ正しく変換する", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    makeLocalFiles();
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/earnings-calendar/overseas/manifest")) return makeFetchOk(SAMPLE_OVERSEAS_MANIFEST);
      if (u.includes("/earnings-calendar/overseas/latest")) return makeFetchOk(SAMPLE_OVERSEAS_RAW);
      if (u.includes("/earnings-calendar/overseas/monthly/")) return makeFetchOk(SAMPLE_OVERSEAS_RAW);
      return makeFetch404();
    });

    const result = await loadEarningsCalendarPageData();

    const latest = result.overseas.latest;
    expect(latest).not.toBeNull();
    const item = latest!.calendar[0].items[0];
    expect(item.code).toBe("AAPL");
    expect(item.name).toBe("Apple Inc.");
    expect(item.time).toBe("08:00");
    expect(item.market).toBe("NASDAQ");
    expect(item.announcement_type).toBe("Q2 2025");
    // sch_flg === "1" → "予定"
    expect(item.publish_status).toBe("予定");
    expect(item.progress_status).toBe("US");
  });
});
