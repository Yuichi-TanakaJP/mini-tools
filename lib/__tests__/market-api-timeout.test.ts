import { afterEach, expect, it, vi } from "vitest";
import { fetchJson } from "../market-api";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("allows the measured cold startup for market reads but still aborts at its bound", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal;
  vi.stubGlobal("fetch", vi.fn((_url, init) => {
    signal = init.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  }));
  const pending = fetchJson("https://fixture.example/ranking/manifest", 0, { cache: "no-store", timeoutMs: 10_000 });
  const assertion = expect(pending).rejects.toThrow("aborted");
  await vi.advanceTimersByTimeAsync(6151);
  expect(signal!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(3849);
  await assertion;
  expect(signal!.aborted).toBe(true);
});
