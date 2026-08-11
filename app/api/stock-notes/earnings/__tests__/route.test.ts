import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyMonth() {
  return { as_of_date: "2026-08-10", calendar: [] as unknown[] };
}

function request(codes = "7203"): Request {
  return new Request(`https://mini.example.com/api/stock-notes/earnings?codes=${codes}`);
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

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("codes クエリが無ければ400（全銘柄を誤って返さないため必須にする）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://mini.example.com/api/stock-notes/earnings"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("codes クエリが空文字だけなら400", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://mini.example.com/api/stock-notes/earnings?codes=,,"));

    expect(response.status).toBe(400);
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
        return Promise.resolve(jsonResponse(emptyMonth()));
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(502);
  });

  it("正常時は畳み込んだ決算情報とmanifestのwindowTo、complete:trueを返す", async () => {
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
        return Promise.resolve(jsonResponse(emptyMonth()));
      }),
    );

    const response = await GET(request("7203"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(body.asOfDate).toBe("2026-08-10");
    expect(body.windowTo).toBe("2026-09-30");
    expect(body.complete).toBe(true);
    expect(body.missingMonths).toEqual([]);
    expect(body.earnings["7203"]).toEqual({
      date: "2026-08-14",
      announcementType: "本決算",
      publishStatus: "予定",
    });
  });

  it("codes で指定していない銘柄はレスポンスに含まれない（ペイロードを絞り込む）", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    const augData = {
      as_of_date: "2026-08-10",
      calendar: [
        {
          date: "2026-08-14",
          count: 2,
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
            {
              time: "15:00",
              code: "9999",
              name: "対象外テスト",
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
        if (url.includes("/manifest")) return Promise.reject(new Error("skip"));
        if (url.includes("/monthly/2026-08")) return Promise.resolve(jsonResponse(augData));
        return Promise.resolve(jsonResponse(emptyMonth()));
      }),
    );

    const response = await GET(request("7203"));
    const body = await response.json();

    expect(Object.keys(body.earnings)).toEqual(["7203"]);
  });

  it("当月以外の月が失敗したら200のままcomplete:falseとmissingMonthsを返す", async () => {
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
        if (url.includes("/manifest")) return Promise.reject(new Error("skip"));
        if (url.includes("/monthly/2026-08")) return Promise.resolve(jsonResponse(augData));
        // 当月以外（前月・翌月・翌々月）の取得を失敗させる
        return Promise.reject(new Error("upstream flaky"));
      }),
    );

    const response = await GET(request("7203"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.complete).toBe(false);
    expect(body.missingMonths.length).toBeGreaterThan(0);
    expect(body.missingMonths).not.toContain("2026-08");
  });

  describe("complete の判定は manifest の公開範囲（current_window）を基準にする", () => {
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

    it("公開範囲を超える月（2026-10）しか欠けていない場合は complete:true になる（実サーバーで確認した回帰の再現）", async () => {
      process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
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
          if (url.includes("/monthly/2026-10")) {
            // current_window.to (2026-09-30) より先の月はまだ公開されていない
            // （market-info-api が404等で返す状況を再現）
            return Promise.reject(new Error("not published yet"));
          }
          return Promise.resolve(jsonResponse(augData));
        }),
      );

      const response = await GET(request("7203"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.windowTo).toBe("2026-09-30");
      expect(body.complete).toBe(true);
      expect(body.missingMonths).toEqual([]);
    });

    it("公開範囲内の月（2026-09）が取得できなかった場合は complete:false になる", async () => {
      process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
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
          if (url.includes("/monthly/2026-09")) {
            return Promise.reject(new Error("upstream flaky"));
          }
          return Promise.resolve(jsonResponse(augData));
        }),
      );

      const response = await GET(request("7203"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.complete).toBe(false);
      expect(body.missingMonths).toContain("2026-09");
    });

    it("manifest取得が失敗すると公開範囲が分からないため、欠落月をそのまま complete:false に反映する", async () => {
      process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => {
          if (url.includes("/manifest")) {
            return Promise.reject(new Error("manifest down"));
          }
          if (url.includes("/monthly/2026-10")) {
            return Promise.reject(new Error("not published yet"));
          }
          return Promise.resolve(jsonResponse(augData));
        }),
      );

      const response = await GET(request("7203"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.windowTo).toBeNull();
      expect(body.complete).toBe(false);
      expect(body.missingMonths).toContain("2026-10");
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
        return Promise.resolve(jsonResponse(emptyMonth()));
      }),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.windowTo).toBeNull();
  });
});
