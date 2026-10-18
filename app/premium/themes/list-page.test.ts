import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadThemeListPage, parseThemeListPageResponse } from "./data-loader";

const item = { id: "theme-1", slug: "theme", displayName: "Theme", status: "active" };
function page(overrides: Record<string, unknown> = {}) {
  return { schemaVersion: "theme-viewer-list.v2", themes: [item], hasMore: false, nextCursor: null, ...overrides };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubEnv("STOCK_NOTES_API_BASE_URL", "https://stock-notes.example.test/api/");
  vi.stubEnv("STOCK_NOTES_API_TOKEN", "test-secret-never-props");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("lightweight theme list pages", () => {
  it("requests one bounded page with server-only authorization and no-store", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page({ hasMore: true, nextCursor: "next_cursor" })));
    const result = await loadThemeListPage(undefined, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://stock-notes.example.test/api/viewer/theme-cards?limit=10", expect.objectContaining({
      method: "GET", cache: "no-store", signal: expect.any(AbortSignal),
      headers: { Accept: "application/json", Authorization: "Bearer test-secret-never-props" },
    }));
    expect(result).toMatchObject({ status: "ok", data: { contractVersion: "theme-viewer-list.v2", hasMore: true, nextCursor: "next_cursor" } });
    expect(JSON.stringify(result)).not.toContain("test-secret-never-props");
  });

  it("uses a supplied cursor without aggregating more requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page()));
    await loadThemeListPage("opaque_cursor-1", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("https://stock-notes.example.test/api/viewer/theme-cards?limit=10&cursor=opaque_cursor-1");
  });

  it("retains summaries and nullable counts while excluding unused nested analysis", () => {
    const data = parseThemeListPageResponse(page({ themes: [{ ...item, summary: "Short summary", analysisCount: null, openActionCount: 0, latest_analysis: { body: "not for list" } }] }));
    expect(data.themes[0]).toMatchObject({ summary: "Short summary", analysisCount: null, openActionCount: 0 });
    expect(JSON.stringify(data)).not.toContain("not for list");
  });

  it("distinguishes an empty final page from a request failure", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page({ themes: [] })));
    expect(await loadThemeListPage(undefined, fetcher)).toMatchObject({ status: "empty", data: { hasMore: false, nextCursor: null } });
  });

  it.each(["", "a/b", "a".repeat(129), ["cursor", "second"]])("rejects an invalid cursor without fetching: %s", async (cursor) => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await loadThemeListPage(cursor, fetcher)).toMatchObject({ status: "invalid_cursor" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { nextCursor: undefined }, { hasMore: undefined }, { hasMore: true },
    { nextCursor: "next" }, { hasMore: true, nextCursor: "bad/cursor" },
    { hasMore: true, nextCursor: "next", themes: [] },
    { themes: null }, { themes: [item, item] }, { themes: Array.from({ length: 11 }, (_, i) => ({ ...item, id: `theme-${i}` })) },
    { schemaVersion: "theme-viewer.v1" }, { themes: [{ id: "missing-fields" }] },
  ])("rejects malformed or incomplete pagination contracts: %j", async (overrides) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page(overrides)));
    expect(await loadThemeListPage(undefined, fetcher)).toMatchObject({ status: "invalid_response" });
  });

  it("rejects a continuation loop", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page({ hasMore: true, nextCursor: "same" })));
    expect(await loadThemeListPage("same", fetcher)).toMatchObject({ status: "invalid_response" });
  });

  it.each([[401, "unauthorized"], [413, "upstream_error"], [503, "upstream_error"], [400, "invalid_cursor"]])("keeps HTTP %s as an error without leaking the body", async (status, expected) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ detail: "private upstream data" }, status as number));
    const result = await loadThemeListPage("valid_cursor", fetcher);
    expect(result).toMatchObject({ status: expected, httpStatus: status });
    expect(JSON.stringify(result)).not.toContain("private upstream data");
  });

  it("aborts a stalled page after five seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = loadThemeListPage(undefined, fetcher);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toMatchObject({ status: "upstream_error" });
  });
});
