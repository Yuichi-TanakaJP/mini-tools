import { describe, expect, it } from "vitest";
import { buildStockPriceByCode, parseYutaiStockPriceSnapshot } from "../stock-prices";

describe("parseYutaiStockPriceSnapshot", () => {
  const currentPayload = (priceDate = "2026-10-23", fetchedAt = "2026-10-23T16:45:00+09:00") => ({
    schema_version: 1, scope_month: "2026-10", generated_at: fetchedAt,
    provider: "yahoo_finance_chart", record_count: 1, success_count: 1,
    records: [{ code: "9319", status: "ok", price: 1606, price_date: priceDate, fetched_at: fetchedAt }],
  });
  const expected = { scopeMonth: "2026-10", now: new Date("2026-10-25T18:00:00+09:00") };

  it("要求月と異なる古いsnapshotを計算に渡さない", () => {
    expect(parseYutaiStockPriceSnapshot({ ...currentPayload(), scope_month: "2026-08" }, expected)).toBeNull();
  });

  it("週末には直前金曜の終値を採用できる", () => {
    expect(parseYutaiStockPriceSnapshot(currentPayload(), expected)?.quotes[0].priceYen).toBe(1606);
  });

  it.each(["2026-08-19", "2026-10-26", "2026-02-30", "invalid"])("古すぎる・未来・不正な基準日を除外する: %s", (day) => {
    expect(parseYutaiStockPriceSnapshot(currentPayload(day), expected)?.quotes).toEqual([]);
  });

  it.each(["invalid", "2026-10-26T16:00:00+09:00"])("不正・未来の取得時刻を除外する: %s", (at) => {
    expect(parseYutaiStockPriceSnapshot(currentPayload("2026-10-23", at), expected)?.quotes).toEqual([]);
  });

  it("取得成功レコードだけを画面用quoteへ変換する", () => {
    const snapshot = parseYutaiStockPriceSnapshot({
      schema_version: 1,
      scope_month: "2026-07",
      generated_at: "2026-07-20T06:05:04+00:00",
      provider: "yahoo_finance_chart",
      record_count: 2,
      success_count: 1,
      records: [
        {
          code: "1000",
          status: "ok",
          price: 100.5,
          price_date: "2026-07-17",
          fetched_at: "2026-07-20T05:50:00+00:00",
        },
        {
          code: "2000",
          status: "error",
          price: null,
          price_date: null,
          fetched_at: "2026-07-20T05:51:00+00:00",
        },
      ],
    });

    expect(snapshot?.quotes).toEqual([{
      code: "1000",
      priceYen: 100.5,
      priceDate: "2026-07-17",
      fetchedAt: "2026-07-20T05:50:00+00:00",
    }]);
    expect(buildStockPriceByCode(snapshot).get("1000")?.priceYen).toBe(100.5);
  });

  it.each([
    null,
    {},
    { schema_version: 2, records: [] },
    { schema_version: 1, records: [] },
  ])("必須メタデータがない応答は拒否する: %o", (value) => {
    expect(parseYutaiStockPriceSnapshot(value)).toBeNull();
  });
});
