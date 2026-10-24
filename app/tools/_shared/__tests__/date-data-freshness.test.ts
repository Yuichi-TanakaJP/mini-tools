import { expect, it, vi } from "vitest";
import { buildDateDataRoute } from "../date-data-route";
it("refresh uses the strict loader and never substitutes bundled success", async () => {
  const fallback = vi.fn().mockResolvedValue({ date: "2026-10-20", old: true });
  const strict = vi.fn().mockResolvedValue(null);
  const get = buildDateDataRoute(fallback, { refreshLoader: strict, cacheControl: "no-store" });
  const context = { params: Promise.resolve({ date: "2026-10-20" }) };
  const failed = await get(new Request("https://fixture.example/data", { headers: { "x-market-refresh": "1" } }), context);
  expect(failed.status).toBe(404);
  expect(strict).toHaveBeenCalledOnce(); expect(fallback).not.toHaveBeenCalled();
  const normal = await get(new Request("https://fixture.example/data"), context);
  expect(normal.status).toBe(200); expect(await normal.json()).toMatchObject({ old: true });
  expect(normal.headers.get("cache-control")).toBe("no-store");
});
