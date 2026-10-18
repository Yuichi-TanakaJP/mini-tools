import { describe, expect, it } from "vitest";
import { internalNavigationTarget } from "./navigation-target";
import { themeListHref } from "@/app/premium/themes/navigation";
describe("navigation boundaries", () => {
  const from = "https://example.test/tools/a?month=1";
  it.each(["http://[", "#part", "/tools/a?month=1", "https://other.test/", "mailto:a@example.test", "javascript:void(0)"])("ignores %s", href => expect(internalNavigationTarget(href, from)).toBeNull());
  it("tracks query-only moves", () => expect(internalNavigationTarget("?month=2", from)).toBe("/tools/a?month=2"));
  it("preserves a valid opaque cursor", () => expect(themeListHref("valid_123")).toBe("/premium/themes?cursor=valid_123"));
  it.each(["//evil.test", "../account", "a".repeat(129), ["a", "b"]])("rejects unsafe cursors", cursor => expect(themeListHref(cursor)).toBe("/premium/themes"));
});
