import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ShortDividendRevisions from "./ShortDividendRevisions";

describe("short dividend forecast revisions", () => {
  it("shows the amount, delta and both publication dates for 6890", () => {
    const html = renderToStaticMarkup(createElement(ShortDividendRevisions, { data: {
      status: "ready", rows: [{
        id: "revision", ticker: "6890", fiscal_period_start: "2026-04-01",
        fiscal_period_end: "2026-12-31", published_on: "2026-11-16",
        previous_published_on: "2026-08-14", forecast_dps: "300",
        previous_forecast_dps: "200", revision_delta_dps: "100",
      }],
    } }));
    expect(html).toContain("200円 → 300円（100円増）");
    expect(html).toContain("2026-08-14 → 2026-11-16");
  });
});
