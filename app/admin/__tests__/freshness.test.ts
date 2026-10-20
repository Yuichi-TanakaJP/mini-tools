import { describe, expect, it } from "vitest";
import { classifyFreshnessDate, getAgeDaysFromDate } from "../freshness";

describe("admin freshness", () => {
  it("accepts slash-separated generated_at_jst values", () => {
    expect(getAgeDaysFromDate("2026/06/11 16:30:05", "2026-06-15")).toBe(4);
    expect(classifyFreshnessDate("2026/06/11 16:30:05", 8, "2026-06-15")).toBe("recent");
  });

  it("still classifies an old weekly start date as stale", () => {
    expect(classifyFreshnessDate("2026-06-01", 8, "2026-06-15")).toBe("stale");
  });

  it("uses the monthly SLA window instead of the fixed seven-day threshold", () => {
    expect(classifyFreshnessDate("2026-05-31T23:34:27Z", 35, "2026-06-15")).toBe("recent");
    expect(classifyFreshnessDate("2026-05-10T23:34:27Z", 35, "2026-06-15")).toBe("stale");
  });
});


describe("unknown date evidence", () => {
  it.each(["", "garbage", "2026-02-30", "2026-13-01", "2026-10-21"])("does not mark %s healthy", value => {
    expect(getAgeDaysFromDate(value, "2026-10-20")).toBeNull();
    expect(classifyFreshnessDate(value, 7, "2026-10-20")).toBe("unknown");
  });
  it("keeps failed, absent and valid dates separate", () => {
    expect(classifyFreshnessDate(null, 7, "2026-10-20")).toBe("failed");
    expect(classifyFreshnessDate(undefined, 7, "2026-10-20")).toBe("none");
    expect(classifyFreshnessDate("2026-10-20", 7, "2026-10-20")).toBe("fresh");
  });
});
