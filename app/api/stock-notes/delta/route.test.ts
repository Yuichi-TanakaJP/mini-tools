import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const state = vi.hoisted(() => ({ user: true, stocks: [] as Record<string, unknown>[], rpcData: null as unknown, reads: [] as string[] }));
vi.mock("@/lib/supabase/config", () => ({ isSyncConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "owner" } : null } }) },
  rpc: async () => ({ error: null, data: state.rpcData }),
  from: (table: string) => {
    state.reads.push(table);
    const query = { select: () => query, eq: () => query, returns: async () => ({ error: null, data: table === "stock_notes_stocks" ? state.stocks : [] }) };
    return query;
  },
}) }));
function request(manifest = {}) { return new Request("https://example.invalid/api/stock-notes/delta", { method: "POST", body: JSON.stringify({ knownManifest: manifest }) }); }
beforeEach(() => {
  state.user = true; state.reads = []; state.rpcData = null;
  state.stocks = [{ id: "s1", code: "1234", name: "Example", category: "research", category_changed_at: null, category_change_reason: "preserved", watch_purposes: ["growth"], credit_monitoring_enabled: true, created_at: "2026-01-01", updated_at: "2026-01-01" }];
});
describe("stock delta monitoring contract", () => {
  it("does not trust an old RPC even when its unchanged-stock response is empty", async () => {
    state.rpcData = { version: 1, complete: true, currentManifest: { s1: "old-revision" }, changedStocks: [], deletedStockIds: [] };
    const response = await POST(request({ s1: "old-revision" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const data = await response.json();
    expect(state.reads).toHaveLength(4);
    expect(data.monitoringMetadataVersion).toBe(1);
    expect(data.changedStocks[0].stock).toMatchObject({ watchPurposes: ["growth"], creditMonitoringEnabled: true, category: "research", categoryChangeReason: "preserved" });
  });
  it("includes metadata in the compatibility revision, independent of timestamp", async () => {
    const first = await (await POST(request())).json();
    state.stocks[0].credit_monitoring_enabled = false;
    const next = await (await POST(request(first.currentManifest))).json();
    expect(next.changedStocks).toHaveLength(1);
    expect(next.currentManifest.s1).not.toBe(first.currentManifest.s1);
    expect(next.changedStocks[0].stock.creditMonitoringEnabled).toBe(false);
  });
  it("rejects malformed metadata instead of emitting a false decision", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.stocks[0].credit_monitoring_enabled = "false";
    expect((await POST(request())).status).toBe(502);
    error.mockRestore();
  });
  it("requires existing authentication before reading stock data", async () => {
    state.user = false;
    expect((await POST(request())).status).toBe(401);
    expect(state.reads).toEqual([]);
  });
});
