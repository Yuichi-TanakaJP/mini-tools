import { describe, expect, it } from "vitest";
import { acceptInvestorFlowUpdate } from "../live-data";
import type { InvestorFlowPageData } from "../types";
const make = (start = "2026-10-13", stamp = "2026-10-22T08:00:00Z") => ({
  manifest: { latest: { start_date: start, end_date: "2026-10-16" } }, selectedWeek: { start_date: start, end_date: "2026-10-16" },
  payload: { start_date: start, end_date: "2026-10-16", generated_at_jst: stamp },
  analysisManifest: { weeks: [{start_date: start, end_date: "2026-10-16"}] }, analysis: { start_date: start, end_date: "2026-10-16", generated_at_jst: stamp },
  loadFailed: false, analysisLoadFailed: false,
} as InvestorFlowPageData);

describe("weekly live data", () => {
  it("accepts a new week and a later same-week generation", () => {
    const old = make("2026-10-05", "2026-10-15T08:00:00Z");
    expect(acceptInvestorFlowUpdate(old, make()).payload?.start_date).toBe("2026-10-13");
    expect(acceptInvestorFlowUpdate(make(), make("2026-10-13", "2026-10-22T09:00:00Z"))).toBeTruthy();
  });
  it("rejects rollback, invalid stamp, mismatched body, and partial analysis", () => {
    for (const next of [make("2026-10-05"), make("2026-10-13", "invalid"), { ...make(), payload: { ...make().payload!, start_date: "2026-10-05" } }, { ...make(), analysis: null }, { ...make(), analysisLoadFailed: true }]) {
      expect(() => acceptInvestorFlowUpdate(make(), next)).toThrow();
    }
  });
  it("keeps explicit history pinned instead of jumping to the new latest", () => {
    expect(() => acceptInvestorFlowUpdate(make(), make(), "2026-10-05", "2026-10-09")).toThrow();
  });
});


it("retains accepted analysis when its manifest is unavailable or its timestamp regresses", () => {
  const previous = make();
  previous.analysis!.generated_at_jst = "2026-10-22T10:00:00Z";
  const missing = { ...make(), analysisManifest: null, analysis: null };
  expect(() => acceptInvestorFlowUpdate(previous, missing)).toThrow();
  const stale = make();
  stale.analysis!.generated_at_jst = "2026-10-22T09:00:00Z";
  expect(() => acceptInvestorFlowUpdate(previous, stale)).toThrow();
});


it("accepts a raw-only historical week that does not advertise analysis", () => {
  const history = { ...make(), analysis: null, analysisManifest: { ...make().analysisManifest!, weeks: [] } };
  expect(acceptInvestorFlowUpdate(history, history, "2026-10-13", "2026-10-16")).toBe(history);
});
