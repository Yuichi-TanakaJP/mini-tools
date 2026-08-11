import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyMonth(id: string) {
  return { as_of_date: "2026-08-10", calendar: [] as unknown[] };
}

describe("GET /api/stock-notes/earnings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T03:00:00.000Z")); // JST 12:00
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  it("MARKET_INFO_API_BASE_URL 未設定なら503", async () => {
    delete process.env.MARKET_INFO_API_BASE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("当月分の取得に失敗したら502（未判明と取得失敗を混同しないよう部分表示しない）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/monthly/2026-08")) {
          return Promise.reject(new Error("boom"));
        }
        return Promise.resolve(jsonResponse(emptyMonth("x")));
      }),
    );

    const response = await GET();

    expect(response.status).toBe(502);
  });

  it("正常時は畳み込んだ決算情報とmanifestのwindowToを返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    const augData = {
      as_of_date: "2026-08-10",
      calendar: [
        {
          date: "2026-08-14",
          count: 1,
          detail_status: "present",
          items: [
            {
              time: "15:00",
              code: "7203",
              name: "トヨタ自動車",
              market: "プライム",
              announcement_type: "本決算",
              publish_status: "予定",
              progress_status: "",
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/manifest")) {
          return Promise.resolve(
            jsonResponse({
              as_of_date: "2026-08-10",
              current_window: { from: "2026-08-01", to: "2026-09-30" },
              months: [],
            }),
          );
        }
        if (url.includes("/monthly/2026-08")) {
          return Promise.resolve(jsonResponse(augData));
        }
        return Promise.resolve(jsonResponse(emptyMonth("x")));
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(body.asOfDate).toBe("2026-08-10");
    expect(body.windowTo).toBe("2026-09-30");
    expect(body.earnings["7203"]).toEqual({
      date: "2026-08-14",
      announcementType: "本決算",
      publishStatus: "予定",
    });
  });

  it("manifest取得が失敗してもwindowToをnullにして200を返す（決算情報自体は返せるため）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/manifest")) {
          return Promise.reject(new Error("manifest down"));
        }
        return Promise.resolve(jsonResponse(emptyMonth("x")));
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.windowTo).toBeNull();
  });
});
