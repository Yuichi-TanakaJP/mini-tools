import { describe, expect, it, vi, afterEach } from "vitest";
import { isThemeTextRequest, validateThemeTextChunk } from "./text-contract";
import { loadThemeText, parseThemeDetailResponse } from "./data-loader";
const id = "00000000-0000-4000-8000-000000000001";
const revision = "a".repeat(64);
const request = { themeId: id, recordId: id, section: "analysisHistory", field: "body", offset: 0 };
function chunk(text = "本文", offset = 0, totalChars = Array.from(text).length) {
  const end = offset + Array.from(text).length;
  return { ...request, schemaVersion: "theme-viewer-text.v1", text, offset, totalChars, revision, hasMore: end < totalChars, nextOffset: end < totalChars ? end : null };
}
afterEach(() => vi.unstubAllEnvs());
describe("full text contract", () => {
  it("reconstructs >6000 Unicode characters including the final marker", () => {
    const text = "文😀".repeat(6000) + "末尾";
    const parts = Array.from(text); let offset = 0; let output = "";
    while (offset < parts.length) {
      const piece = parts.slice(offset, offset + 2000).join("");
      const c = validateThemeTextChunk(chunk(piece, offset, parts.length), { ...request, offset, revision: offset ? revision : undefined });
      output += c.text; offset += Array.from(c.text).length;
    }
    expect(output).toBe(text); expect(output.endsWith("末尾")).toBe(true);
  });
  it.each(["constructor", "__proto__", "unknown"])("rejects non-allowlisted section %s", (section) => {
    expect(isThemeTextRequest({ ...request, section })).toBe(false);
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects bad offset %s", offset => expect(isThemeTextRequest({ ...request, offset })).toBe(false));
  it("requires continuation revision and rejects unknown fields", () => {
    expect(isThemeTextRequest({ ...request, offset: 2000 })).toBe(false);
    expect(isThemeTextRequest({ ...request, offset: 2000, revision })).toBe(true);
    expect(isThemeTextRequest({ ...request, field: "user_id" })).toBe(false);
  });
  it.each([
    { text: "a".repeat(2001), totalChars: 2001 }, { offset: 1 }, { recordId: "other" },
    { hasMore: true }, { nextOffset: 1 }, { totalChars: 0 }, { revision: "bad" },
  ])("rejects malformed chunks %j", changes => expect(() => validateThemeTextChunk({ ...chunk(), ...changes }, request)).toThrow());
  it("rejects changed revision", () => expect(() => validateThemeTextChunk(chunk(), { ...request, revision: "b".repeat(64) })).toThrow());
  it("accepts empty as registered absence", () => expect(validateThemeTextChunk(chunk(""), request).totalChars).toBe(0));
  it("keeps metadata absent for old APIs and validates new metadata", () => {
    const base = { schemaVersion: "theme-viewer.v1", theme: { id, slug: "test", displayName: "Test", status: "draft" } };
    expect(parseThemeDetailResponse(base)?.textSources).toBeUndefined();
    expect(parseThemeDetailResponse({ ...base, textSources: [{ section: "analysisHistory", recordId: id, fields: ["body"] }] })?.textSources?.[0].fields).toEqual(["body"]);
    expect(() => parseThemeDetailResponse({ ...base, textSources: [{ section: "unknown", recordId: id, fields: ["body"] }] })).toThrow();
  });
  it("loads exactly one bounded chunk and keeps credentials server side", async () => {
    vi.stubEnv("STOCK_NOTES_API_BASE_URL", "https://example.com/prefix"); vi.stubEnv("STOCK_NOTES_API_TOKEN", "synthetic-token");
    const fetcher = vi.fn().mockResolvedValue(Response.json(chunk()));
    const result = await loadThemeText(request, fetcher);
    expect(result.status).toBe("ok"); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`https://example.com/prefix/viewer/themes/${id}/text/analysisHistory/${id}/body?offset=0`);
    expect(JSON.stringify(result)).not.toContain("synthetic-token");
  });
  it("preserves conflict without forwarding upstream body", async () => {
    vi.stubEnv("STOCK_NOTES_API_BASE_URL", "https://example.com"); vi.stubEnv("STOCK_NOTES_API_TOKEN", "synthetic-token");
    const result = await loadThemeText(request, vi.fn().mockResolvedValue(new Response("private upstream", { status: 409 })));
    expect(result).toMatchObject({ httpStatus: 409 }); expect(JSON.stringify(result)).not.toContain("private upstream");
  });
});
