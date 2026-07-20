import { describe, expect, it } from "vitest";
import { buildStockPriceByCode, parseYutaiStockPriceSnapshot } from "../stock-prices";

describe("parseYutaiStockPriceSnapshot", () => {
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
