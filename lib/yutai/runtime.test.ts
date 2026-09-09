import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { createYutaiRuntime } from "./runtime";

function fixture() {
  let callback: (event: AuthChangeEvent, session: Session | null) => void;
  let session: Session | null = null;
  let online = true;
  const window = new EventTarget(), document = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const unsubscribe = vi.fn();
  const headers: string[] = [];
  const getSession = vi.fn(async () => ({ data: { session }, error: null }));
  const rpc = vi.fn((name: string, args: { p_month: number }) => ({
    setHeader: (_name: string, value: string) => {
      headers.push(value);
      return { abortSignal: async (signal: AbortSignal) => ({ error: signal.aborted ? new Error("aborted") : null, data: {
        schema_version: 1, selected_month: args.p_month, as_of: "2026-09-09T00:00:00Z",
        counts: { profiles: 0, month_states: 0, cycles: 0, tags: 0, profile_tags: 0, rewards: 0, reward_events: 0, selections: 0, effective_selections: 0 },
        profiles: [], month_states: [], cycles: [], tags: [], profile_tags: [], rewards: [], reward_events: [], selections: [], effective_selections: [],
      } }) };
    },
  }));
  const client = { rpc, auth: { getSession, onAuthStateChange: (cb: typeof callback) => {
    callback = cb; return { data: { subscription: { unsubscribe } } };
  } } } as unknown as SupabaseClient;
  const runtime = createYutaiRuntime(client, { window, document, online: () => online });
  return { runtime, rpc, getSession, headers, window, document, unsubscribe,
    online: (value: boolean) => { online = value; },
    auth: (id: string | null, event: AuthChangeEvent = "SIGNED_IN") => {
      session = id ? { user: { id }, access_token: `synthetic-${id}` } as Session : null;
      callback(event, session);
    } };
}
afterEach(() => vi.useRealTimers());
describe("Supabase browser runtime", () => {
  it("uses real-session owner scope and defers RPC outside auth callback", async () => {
    vi.useFakeTimers(); const f = fixture(); f.runtime.watch(9);
    f.auth("A", "INITIAL_SESSION");
    expect(f.rpc).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledWith("stock_notes_get_yutai_workspace", { p_month: 9 });
    expect(f.headers).toEqual(["Bearer synthetic-A"]);
    expect(f.runtime.repository.getSnapshot(9).status).toBe("ready");
    f.runtime.dispose();
  });
  it("does not discard cache on same-user token refresh, and clears it at signout", async () => {
    vi.useFakeTimers(); const f = fixture(); f.runtime.watch(9); f.auth("A"); await vi.runAllTimersAsync();
    const state = f.runtime.repository.getSnapshot(9);
    f.auth("A", "TOKEN_REFRESHED"); await vi.runAllTimersAsync();
    expect(f.runtime.repository.getSnapshot(9)).toBe(state);
    f.auth(null, "SIGNED_OUT");
    expect(f.runtime.repository.getSnapshot(9).data).toBeNull();
    f.runtime.dispose();
  });
  it("refreshes watched screens on foreground/manual/online but not hidden or unmounted", async () => {
    vi.useFakeTimers(); const f = fixture(); const release = f.runtime.watch(9); f.auth("A"); await vi.runAllTimersAsync();
    f.window.dispatchEvent(new Event("focus")); await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledTimes(2);
    f.document.visibilityState = "hidden"; f.window.dispatchEvent(new Event("focus")); await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledTimes(2);
    f.document.visibilityState = "visible"; f.document.dispatchEvent(new Event("visibilitychange")); await vi.runAllTimersAsync();
    f.online(false); f.window.dispatchEvent(new Event("offline")); await vi.runAllTimersAsync();
    expect(f.runtime.repository.getSnapshot(9)).toMatchObject({ stale: true, error: { kind: "offline" } });
    f.online(true); f.window.dispatchEvent(new Event("online")); await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledTimes(4);
    release(); f.window.dispatchEvent(new Event("focus")); await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledTimes(4); f.runtime.dispose();
  });
  it("refuses RPC when session lookup returns a different owner", async () => {
    vi.useFakeTimers(); const f = fixture(); f.auth("A");
    f.getSession.mockResolvedValueOnce({ data: { session: { user: { id: "B" } } as Session }, error: null });
    await expect(f.runtime.repository.load(9)).rejects.toMatchObject({ kind: "auth" });
    expect(f.rpc).not.toHaveBeenCalled();
    f.runtime.watch(9); f.auth("A", "TOKEN_REFRESHED"); await vi.runAllTimersAsync();
    expect(f.runtime.repository.getSnapshot(9).status).toBe("ready");
    f.runtime.dispose();
  });
  it("refuses a delayed session lookup after account changes", async () => {
    vi.useFakeTimers(); const f = fixture(); f.auth("A");
    let resolve: (result: Awaited<ReturnType<typeof f.getSession>>) => void;
    f.getSession.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = f.runtime.repository.load(9); await Promise.resolve();
    f.auth("B"); resolve({ data: { session: { user: { id: "A" }, access_token: "synthetic-A" } as Session }, error: null });
    await expect(pending).rejects.toMatchObject({ kind: "auth" });
    expect(f.rpc).not.toHaveBeenCalled(); f.runtime.dispose();
  });
  it("cleans up auth and browser event listeners on disposal", async () => {
    vi.useFakeTimers(); const f = fixture(); f.runtime.watch(9); f.auth("A"); await vi.runAllTimersAsync();
    f.runtime.dispose(); expect(f.unsubscribe).toHaveBeenCalledOnce();
    f.window.dispatchEvent(new Event("focus")); f.auth("B"); await vi.runAllTimersAsync();
    expect(f.rpc).toHaveBeenCalledTimes(1); expect(f.runtime.repository.getSnapshot(9).data).toBeNull();
  });
  it("times out an RPC without reporting an empty successful read", async () => {
    vi.useFakeTimers(); const f = fixture(); f.auth("A");
    f.rpc.mockImplementationOnce(() => ({ setHeader: () => ({ abortSignal: (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")))) }) }));
    const pending = f.runtime.repository.load(9);
    const assertion = expect(pending).rejects.toMatchObject({ kind: "unknown" });
    await vi.advanceTimersByTimeAsync(15_000); await assertion;
    expect(f.runtime.repository.getSnapshot(9)).toMatchObject({ status: "error", data: null });
    f.runtime.dispose();
  });
});
