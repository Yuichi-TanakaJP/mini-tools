import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketDateQuality, marketDateSummary } from "../market-date-quality";

describe("market date quality", () => {
  it("distinguishes weekdays from weekends without inferring a trading date", () => {
    expect(marketDateSummary(["2026-10-18", "2026-10-17", "2026-09-24", "2026-10-18", "2026-02-30"])).toEqual({ weekendCount: 2, latestWeekday: "2026-09-24" });
    expect(marketDateSummary([])).toEqual({ weekendCount: 0, latestWeekday: null });
  });
  it("does not claim fresh, source verification or data repair from a new collection date", () => {
    const html = renderToStaticMarkup(<MarketDateQuality rows={[{name:"ランキング",source:"/ranking/manifest",latest:"2026-10-20",generatedAt:"2026-10-19T15:51:19Z",history:["2026-10-20","2026-10-18"]}]} />);
    expect(html).toContain("ランキング：未確認");
    expect(html).toContain("2026-10-19T15:51:19Z");
    expect(html).toContain("祝日未判定");
    expect(html).toContain("UNKNOWN");
  });
});
