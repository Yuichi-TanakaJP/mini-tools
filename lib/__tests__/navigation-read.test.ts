import { afterEach, expect, it, vi } from "vitest";
import { readNavigationJson } from "../navigation-read";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("returns valid data and forwards cancellation", async () => {
  const controller = new AbortController();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ date: "2026-01-01" })));
  vi.stubGlobal("fetch", fetcher);
  expect(await readNavigationJson("/test", { signal: controller.signal })).toEqual({ date: "2026-01-01" });
  expect(fetcher.mock.calls[0][1].method).toBe("GET");
});
it("does not expose upstream error content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private body", { status: 503 })));
  await expect(readNavigationJson("/test")).rejects.toThrow("HTTP 503");
});
it("times out an unresponsive request", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))));
  const pending = readNavigationJson("/test").catch(error => error.message);
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toContain("時間内");
});
it("cancels a superseded request without reporting a timeout", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("cancelled"))))));
  const pending = readNavigationJson("/test", { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow("cancelled");
});
