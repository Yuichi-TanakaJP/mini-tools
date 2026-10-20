import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { confirmedMarketDate, parseMarketObservation } from "../market-observation";
import { MarketObservationNotice } from "@/app/tools/_shared/market-observation";

const unknown = { snapshot_id: "a".repeat(32), source: "naito_ranking", market_date: null,
  date_basis: "unknown", source_observed_at: null, collected_at: "2026-10-20T00:50:00Z",
  generated_at: "2026-10-20T00:51:00Z", input_sha256: "b".repeat(64) };

describe("market observation", () => {
  it("does not certify from collection time or generation time", () => {
    expect(confirmedMarketDate(unknown)).toBeNull();
    const html = renderToStaticMarkup(<MarketObservationNotice observation={unknown} savedDate="2026-10-20" />);
    expect(html).toContain("相場日未確認");
    expect(html).toContain("2026-10-20T00:50:00Z");
    expect(html).toContain("2026-10-20T00:51:00Z");
    expect(html).toContain("再取得や確認操作は不要");
  });
  it("automatically displays an explicit source day separately", () => {
    const explicit = { ...unknown, date_basis: "explicit_source", market_date: "2026-10-19" };
    expect(confirmedMarketDate(explicit)).toBe("2026-10-19");
    const html = renderToStaticMarkup(<MarketObservationNotice observation={explicit} savedDate="2026-10-20" />);
    expect(html).toContain("相場日確認済み");
    expect(html).toContain("2026-10-19");
    expect(html).toContain("2026-10-20");
  });
  it("keeps legacy timestamps unknown and rejects contradictory/invalid metadata", () => {
    expect(parseMarketObservation(undefined)).toBeNull();
    expect(parseMarketObservation({ ...unknown, source_observed_at: "not-a-date" })).toBeNull();
    expect(parseMarketObservation({ ...unknown, source_observed_at: "25:99" })).toBeNull();
    expect(parseMarketObservation({ ...unknown, source_observed_at: "15:45" })).not.toBeNull();
    expect(confirmedMarketDate({ ...unknown, market_date: "2026-10-19" })).toBeNull();
    expect(confirmedMarketDate({ ...unknown, date_basis: "explicit_source", market_date: "2026-02-30" })).toBeNull();
    const html = renderToStaticMarkup(<MarketObservationNotice observation={null} savedDate="2026-10-18" generatedAt="2026-10-18T00:00:00Z" />);
    expect(html).toContain("2026-10-18T00:00:00Z");
    expect(html).toContain("未記録（旧データ）");
    expect(html).toContain("2026-10-18");
  });
});
