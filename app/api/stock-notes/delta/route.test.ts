import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const state = vi.hoisted(() => ({ user: true, rpcData: null as unknown, rpcError: null as unknown, afterRpc: null as unknown, calls: [] as unknown[], reads: 0 }));
vi.mock("@/lib/supabase/config", () => ({ isSyncConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "owner" } : null } }) },
  rpc: async (name: string, args: unknown) => { state.calls.push([name, args]); const data = structuredClone(state.rpcData); if (state.afterRpc) state.rpcData = state.afterRpc; return { error: state.rpcError, data }; },
  from: () => { state.reads++; throw new Error("Table reads cannot establish an atomic snapshot"); },
}) }));
const stock = (id: string) => ({ id, code: "1234", name: "Example", category: "research", categoryChangedAt: null, categoryChangeReason: "preserved", watchPurposes: ["growth"], creditMonitoringEnabled: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
const bundle = (id: string) => ({ stock: stock(id), analyses: [], theses: [], actions: [], revision: `rev-${id}` });
const delta = () => ({ version: 1, monitoringMetadataVersion: 1, complete: true, currentManifest: { A: "rev-A", B: "rev-B", C: "rev-C", D: "rev-D" }, changedStocks: ["A", "B", "C", "D"].map(bundle), deletedStockIds: [] });
function request(manifest = {}) { return new Request("https://example.invalid/api/stock-notes/delta", { method: "POST", body: JSON.stringify({ knownManifest: manifest }) }); }
beforeEach(() => { state.user = true; state.calls = []; state.reads = 0; state.rpcError = null; state.afterRpc = null; state.rpcData = delta(); });

describe("atomic stock delta", () => {
  it("uses one versioned owner-authenticated RPC and never splits a snapshot into table pages", async () => {
    state.afterRpc = { ...delta(), currentManifest: { B: "rev-B", C: "rev-C", D: "rev-D", E: "rev-E" }, changedStocks: ["B", "C", "D", "E"].map(bundle) };
    const response = await POST(request({ C: "old" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.calls).toEqual([["get_stock_notes_delta", { p_known_manifest: { C: "old" } }]]);
    const data = await response.json();
    expect(data.changedStocks[2].stock).toMatchObject({ id: "C", creditMonitoringEnabled: null });
    expect(data.deletedStockIds).toEqual([]);
    expect(state.reads).toBe(0);
  });
  it.each(["analyses", "theses", "actions"])("retains C across equal-count replacement in %s without a second read", async (table) => {
    const snapshot = delta();
    snapshot.changedStocks[0][table as "analyses"] = ["A", "B", "C", "D"].map((id) => ({ id, stockId: "A" })) as never;
    state.rpcData = snapshot;
    const replaced = structuredClone(snapshot);
    replaced.changedStocks[0][table as "analyses"] = ["B", "C", "D", "E"].map((id) => ({ id, stockId: "A" })) as never;
    state.afterRpc = replaced;
    // The simulated writer replaces A with E immediately after the atomic response.
    const response = await POST(request());
    expect((await response.json()).changedStocks[0][table].map((row: { id: string }) => row.id)).toEqual(["A", "B", "C", "D"]);
    expect(state.calls).toHaveLength(1);
    expect(state.reads).toBe(0);
  });
  it.each([
    { version: 1, complete: true, currentManifest: {}, changedStocks: [], deletedStockIds: [] },
    { ...delta(), changedStocks: [{ ...bundle("A"), stock: { ...stock("A"), creditMonitoringEnabled: "false" } }] },
  ])("fails closed for legacy or malformed RPC rather than reading capped tables", async (data) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpcData = data;
    expect((await POST(request())).status).toBe(502);
    expect(state.reads).toBe(0);
    spy.mockRestore();
  });
  it("fails closed for RPC errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpcError = { message: "unavailable" };
    expect((await POST(request())).status).toBe(502);
    expect(state.reads).toBe(0);
    spy.mockRestore();
  });
  it("requires authentication before calling the RPC", async () => {
    state.user = false;
    expect((await POST(request())).status).toBe(401);
    expect(state.calls).toEqual([]);
  });
});
