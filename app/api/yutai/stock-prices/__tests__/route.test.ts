import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPremiumSessionValue } from "@/lib/premium-auth";
import { GET } from "../route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mockedCookies = vi.mocked(cookies);

function request(month = "2026-07") {
  return new Request(`https://mini.example.com/api/yutai/stock-prices?month=${month}`);
}

function setSession(value?: string) {
  mockedCookies.mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  } as never);
}

describe("GET /api/yutai/stock-prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PREMIUM_ACCESS_SECRET = "test-premium-secret";
    process.env.MARKET_INFO_API_BASE_URL = "https://market.example.com";
    process.env.MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN = "server-only-token";
  });

  afterEach(() => {
    delete process.env.PREMIUM_ACCESS_SECRET;
    delete process.env.MARKET_INFO_API_BASE_URL;
    delete process.env.MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN;
    vi.unstubAllGlobals();
  });

  it("未ログインでは上流を呼ばず404を返す", async () => {
    setSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("サーバー間token未設定では上流を呼ばず503を返す", async () => {
    setSession(createPremiumSessionValue());
    delete process.env.MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("認証後だけBearer token付きで上流のprivate endpointを呼ぶ", async () => {
    setSession(createPremiumSessionValue());
    const payload = {
      schema_version: 1,
      scope_month: "2026-07",
      generated_at: "2026-07-20T06:05:04+00:00",
      provider: "yahoo_finance_chart",
      source_batch_dates: ["2026-07-20"],
      record_count: 1,
      success_count: 1,
      records: [
        {
          code: "1000",
          target_months: ["2026-07"],
          status: "ok",
          price: 100.5,
          price_date: "2026-07-17",
          fetched_at: "2026-07-20T05:50:00+00:00",
          error_code: null,
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400, stale-if-error=604800");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://market.example.com/yutai/stock-prices/latest");
    expect(options).toMatchObject({
      headers: { Authorization: "Bearer server-only-token" },
      cache: "no-store",
    });
  });

  it("要求月とpayloadのscope_monthが違う場合はキャッシュしない", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({
        schema_version: 1,
        scope_month: "2026-06",
        generated_at: "2026-07-01T00:00:00+00:00",
        provider: "yahoo_finance_chart",
        record_count: 0,
        success_count: 0,
        records: [],
      }))),
    );

    const response = await GET(request("2026-07"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("要求月が一致しても画面が解釈できないschemaはキャッシュしない", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({
        schema_version: 1,
        scope_month: "2026-07",
      }))),
    );

    const response = await GET(request("2026-07"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("上流認証エラーをtoken非公開の502へ変換する", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: "優待株価APIからデータを取得できませんでした。",
      upstreamStatus: 401,
    });
    expect(JSON.stringify(body)).not.toContain("server-only-token");
  });

  it("上流接続失敗をno-storeの502へ変換する", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const response = await GET(request());

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
