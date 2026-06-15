import { describe, expect, it } from "vitest";
import { classifyFreshnessDate, getAgeDaysFromDate } from "../freshness";

describe("admin freshness", () => {
  it("accepts slash-separated generated_at_jst values", () => {
    expect(getAgeDaysFromDate("2026/06/11 16:30:05", "2026-06-15")).toBe(4);
    expect(classifyFreshnessDate("2026/06/11 16:30:05", "2026-06-15")).toBe("recent");
  });

  it("still classifies an old weekly start date as stale", () => {
    expect(classifyFreshnessDate("2026-06-01", "2026-06-15")).toBe("stale");
  });
});
