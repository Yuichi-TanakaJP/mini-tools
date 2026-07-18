import { describe, expect, it } from "vitest";
import { getSafePremiumNextPath } from "../premium-navigation";

describe("getSafePremiumNextPath", () => {
  it.each([
    ["/premium", "/premium"],
    ["/premium/portfolio?tab=stocks", "/premium/portfolio?tab=stocks"],
    ["/admin", "/admin"],
    ["/tools/yutai-dashboard", "/tools/yutai-dashboard"],
    ["/tools/yutai-dashboard?month=all", "/tools/yutai-dashboard?month=all"],
  ])("許可した内部パスへ復帰できる: %s", (raw, expected) => {
    expect(getSafePremiumNextPath(raw)).toBe(expected);
  });

  it.each([
    "https://example.com/",
    "//example.com/",
    "/tools/yutai-candidates",
    "/premium-evil",
    "/tools/yutai-dashboard\\evil",
  ])("許可していない復帰先をpremiumトップへ戻す: %s", (raw) => {
    expect(getSafePremiumNextPath(raw)).toBe("/premium");
  });
});
