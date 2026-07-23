import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPremiumSessionValue } from "@/lib/premium-auth";
import { GET } from "../route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mockedCookies = vi.mocked(cookies);

function request(month = "2026-09") {
  return new Request(`https://mini.example.com/api/yutai/launch-display?month=${month}`);
}

function setSession(value?: string) {
  mockedCookies.mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  } as never);
}

function payload(month = "2026-09") {
  return {
    schema_version: 1,
    month,
    record_count: 1,
    counts: {
      total: 1,
      conditions_available: 1,
      needs_normalization: 0,
      auto_calculable: 1,
      requires_user_valuation: 0,
      excluded_from_initial_calculation: 0,
    },
    records: [
      {
        month,
        code: "1000",
        company_name: "テスト",
        display_status: "conditions_available",
        calculation_status: "auto_calculable",
        requires_user_valuation: false,
        normalized_status: "draft",
        normalized_as_of_date: "2026-07-22",
        programs: [],
      },
    ],
    generated_at: "2026-07-22T14:57:25.239015Z",
    source: "market_info_yutai_launch_display",
  };
}

describe("GET /api/yutai/launch-display", () => {
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

  it("認証後だけBearer token付きで指定月のprivate endpointを呼ぶ", async () => {
    setSession(createPremiumSessionValue());
    const body = payload();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://market.example.com/yutai/launch-display/monthly/2026-09");
    expect(options).toMatchObject({
      headers: { Authorization: "Bearer server-only-token" },
      cache: "no-store",
    });
  });

  it("月指定なしではlatest endpointを呼ぶ", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload()), { status: 200 })));

    const response = await GET(new Request("https://mini.example.com/api/yutai/launch-display"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetch).toHaveBeenCalledWith(
      "https://market.example.com/yutai/launch-display/latest",
      expect.objectContaining({ headers: { Authorization: "Bearer server-only-token" } }),
    );
  });

  it("上流認証エラーをtoken非公開の502へ変換する", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: "優待条件APIからデータを取得できませんでした。",
      upstreamStatus: 401,
    });
    expect(JSON.stringify(body)).not.toContain("server-only-token");
  });

  it("画面が解釈できないschemaはキャッシュしない", async () => {
    setSession(createPremiumSessionValue());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ schema_version: 1 }))));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
