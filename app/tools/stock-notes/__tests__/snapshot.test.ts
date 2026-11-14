import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStockNotesSnapshotFetchers } from "../data";

function snapshot(ids = ["A", "B", "C", "D"]) {
  return {
    version: 1, monitoringMetadataVersion: 1, complete: true,
    currentManifest: Object.fromEntries(ids.map((id) => [id, `rev-${id}`])), deletedStockIds: [],
    changedStocks: ids.map((id) => ({ stock: { id, code: "1234", name: "Synthetic", watchPurposes: [], creditMonitoringEnabled: null },
      analyses: [{ id: `analysis-${id}`, stockId: id }], theses: [{ id: `thesis-${id}`, stockId: id }], actions: [{ id: `action-${id}`, stockId: id }], revision: `rev-${id}` })),
  };
}
function clientWith(rpc: ReturnType<typeof vi.fn>) {
  return { rpc, from: () => { throw new Error("Non-atomic table read is forbidden"); } } as unknown as SupabaseClient;
}
describe("direct dashboard atomic snapshot", () => {
  it("shares one snapshot across stocks and all children despite equal-count replacement", async () => {
    const before = snapshot();
    const after = snapshot(["B", "C", "D", "E"]);
    const rpc = vi.fn().mockResolvedValueOnce({ data: before, error: null }).mockResolvedValue({ data: after, error: null });
    const readers = createStockNotesSnapshotFetchers(clientWith(rpc));
    const stocks = await readers.fetchStocks();
    // Any later request would see the replacement; the remaining readers must share the first response.
    const [analyses, theses, actions] = await Promise.all([readers.fetchAnalyses(), readers.fetchTheses(), readers.fetchOpenActions()]);
    expect(stocks.map((row) => row.id)).toEqual(["A", "B", "C", "D"]);
    for (const rows of [analyses, theses, actions]) expect(rows.map((row) => row.stockId)).toEqual(["A", "B", "C", "D"]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_stock_notes_delta", { p_known_manifest: {} });
    // A new dashboard load gets a new snapshot, rather than retaining a cross-user/process cache.
    expect((await createStockNotesSnapshotFetchers(clientWith(rpc)).fetchStocks()).map((row) => row.id)).toEqual(["B", "C", "D", "E"]);
  });
  it("does not impose the table row cap on a JSON RPC snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: snapshot(Array.from({ length: 1001 }, (_, i) => `s${i}`)), error: null });
    const readers = createStockNotesSnapshotFetchers(clientWith(rpc));
    expect(await readers.fetchStocks()).toHaveLength(1001);
    expect(await readers.fetchAnalyses()).toHaveLength(1001);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...snapshot(), monitoringMetadataVersion: undefined },
    { ...snapshot(), changedStocks: [] },
    { ...snapshot(), deletedStockIds: ["deleted"] },
    { ...snapshot([]), monitoringMetadataVersion: undefined },
  ])("rejects incomplete and legacy snapshots %j", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    const readers = createStockNotesSnapshotFetchers(clientWith(rpc));
    await expect(readers.fetchStocks()).rejects.toThrow();
    await expect(readers.fetchAnalyses()).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("propagates RPC auth failures without table fallback", async () => {
    const error = { code: "PGRST301", message: "JWT expired" };
    const readers = createStockNotesSnapshotFetchers(clientWith(vi.fn().mockResolvedValue({ data: null, error })));
    await expect(readers.fetchStocks()).rejects.toBe(error);
  });
});
