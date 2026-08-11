import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldingsFetchError, fetchHoldings } from "../data";

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

  it("正常時は my_stocks_items_v1 を normalize して返す", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse(true, 200, {
        items: [
          {
            key: "my_stocks_items_v1",
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
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("7203");
  });

  it("my_stocks_items_v1 が無ければ空配列を返す（本当に0件の場合はエラーにしない）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, { items: [] }));

    await expect(fetchHoldings()).resolves.toEqual([]);
  });
});
