import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldingsFetchError, fetchEarnings, fetchHoldings, normalizeLastEarnings } from "../data";

function makeFetchResponse(ok: boolean, status: number, body: unknown): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchHoldings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("401（セッション切れ）は HoldingsFetchError を status 付きで投げる（空配列にフォールバックしない）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 401, { error: "unauthorized" }));

    await expect(fetchHoldings()).rejects.toMatchObject({
      name: "HoldingsFetchError",
      status: 401,
    });
  });

  it("500 などの他のエラーも HoldingsFetchError を投げる", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 500, { error: "server error" }));

    await expect(fetchHoldings()).rejects.toBeInstanceOf(HoldingsFetchError);
    await expect(fetchHoldings()).rejects.toMatchObject({ status: 500 });
  });

  it("正常時は my_stocks_items_v1 を normalize して返し、同期日時(updatedAt)も返す", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse(true, 200, {
        items: [
          {
            key: "my_stocks_items_v1",
            updatedAt: "2026-06-21T00:00:00.000Z",
            value: [
              {
                id: "a",
                code: "7203",
                name: "トヨタ自動車",
                tab: "holding",
                addedAt: 1,
                updatedAt: 1,
              },
            ],
          },
        ],
      }),
    );

    const result = await fetchHoldings();
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].code).toBe("7203");
    expect(result.updatedAt).toBe("2026-06-21T00:00:00.000Z");
  });

  it("my_stocks_items_v1 が無ければ空配列とnullのupdatedAtを返す（本当に0件の場合はエラーにしない）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, { items: [] }));

    await expect(fetchHoldings()).resolves.toEqual({ holdings: [], updatedAt: null });
  });
});

describe("fetchEarnings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("codes をカンマ区切りのクエリパラメータとして渡す（全銘柄を取りに行かないため必須）", async () => {
    const payload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: {},
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, payload));

    await fetchEarnings(["7203", "6758"]);

    expect(fetch).toHaveBeenCalledWith("/api/stock-notes/earnings?codes=7203%2C6758", { method: "GET" });
  });

  it("失敗時はエラーを投げる（呼び出し側 load.ts でキャッチしてearnings:nullにする）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 502, { error: "boom" }));

    await expect(fetchEarnings(["7203"])).rejects.toThrow();
  });

  it("旧形式（lastEarningsが文字列）のキャッシュ済みレスポンスが来ても落ちずに正規化する（P1回帰防止）", async () => {
    const legacyPayload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: { "5401": "2026-08-04", "4063": "2026-07-24" },
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, legacyPayload));

    const result = await fetchEarnings(["5401", "4063"]);
    expect(result.lastEarnings["5401"]).toEqual({ date: "2026-08-04", announcementType: "", publishStatus: "" });
    expect(result.lastEarnings["4063"]).toEqual({ date: "2026-07-24", announcementType: "", publishStatus: "" });
  });

  it("新形式（オブジェクト）はそのまま通す", async () => {
    const payload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: { "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } },
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, payload));

    const result = await fetchEarnings(["5401"]);
    expect(result.lastEarnings["5401"]).toEqual({ date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" });
  });
});

describe("normalizeLastEarnings", () => {
  it("文字列（旧形式）はオブジェクトに変換する", () => {
    expect(normalizeLastEarnings({ "5401": "2026-08-04" })).toEqual({
      "5401": { date: "2026-08-04", announcementType: "", publishStatus: "" },
    });
  });

  it("既にオブジェクトならそのまま使う（欠けているフィールドは空文字で補う）", () => {
    expect(normalizeLastEarnings({ "5401": { date: "2026-08-04" } })).toEqual({
      "5401": { date: "2026-08-04", announcementType: "", publishStatus: "" },
    });
    expect(
      normalizeLastEarnings({ "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } }),
    ).toEqual({ "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } });
  });

  it("date が無い/文字列でないなど壊れた形は黙って無視する", () => {
    expect(normalizeLastEarnings({ a: { announcementType: "1Q" }, b: 123, c: null, d: undefined })).toEqual({});
  });

  it("null / undefined / オブジェクトでない場合は空オブジェクトを返す", () => {
    expect(normalizeLastEarnings(null)).toEqual({});
    expect(normalizeLastEarnings(undefined)).toEqual({});
    expect(normalizeLastEarnings("not-an-object")).toEqual({});
  });
});
