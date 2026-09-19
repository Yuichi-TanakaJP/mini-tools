import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAudience, loadHoldings, loadWatchCodes, selectReadySnapshot, unavailableHoldings } from "./holdings";

type Row = Record<string, unknown>;
function fixture(options: { positions?: Row[]; instruments?: Row[]; snapshots?: Row[]; portfolios?: Row[]; cap?: number; change?: boolean; fail?: string } = {}) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  let snapshotReads = 0;
  const tables: Record<string, Row[]> = {
    stock_notes_portfolios: options.portfolios ?? [{ id: "p", is_default: true }],
    stock_notes_portfolio_snapshots: options.snapshots ?? [{ id: "s", portfolio_id: "p", status: "ready", portfolio_scope: "official", as_of: "2026-09-04", source_type: "manual", imported_at: "2026-09-04" }],
    stock_notes_portfolio_instruments: options.instruments ?? [{ id: "i", user_id: "u", asset_type: "domestic_stock", identifier: "7203", name: "Toyota" }],
    stock_notes_portfolio_positions: options.positions ?? [{ id: "x", user_id: "u", portfolio_id: "p", snapshot_id: "s", instrument_id: "i", quantity: 100 }],
    stock_notes_stocks: [{ id: "w", user_id: "u", code: "7203", category: "watch" }, { id: "other", user_id: "other", code: "6758", category: "watch" }, { id: "research", user_id: "u", code: "8001", category: "research" }],
  };
  const db = { from(table: string) {
    const call = { table, filters: [] as [string, unknown][] }; calls.push(call);
    let rows = [...tables[table]];
    const orders: { key: string; asc: boolean }[] = [];
    const result = (single = false) => {
      if (options.fail === table) return { data: null, error: new Error("unavailable") };
      if (single && table.endsWith("snapshots") && options.change && ++snapshotReads > 1) return { data: { ...rows[0], id: "changed" }, error: null };
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const q = {
      select() { return q; },
      eq(key: string, value: unknown) { call.filters.push([key, value]); rows = rows.filter((r) => r[key] === value); return q; },
      or() { rows = rows.filter((r) => r.portfolio_scope == null || r.portfolio_scope === "official"); return q; },
      order(key: string, opts?: { ascending: boolean }) { orders.push({ key, asc: opts?.ascending ?? true }); return q; },
      limit(n: number) { rows.sort((a, b) => { for (const o of orders) { const c = String(a[o.key]).localeCompare(String(b[o.key])); if (c) return o.asc ? c : -c; } return 0; }); rows = rows.slice(0, n); return q; },
      range(start: number, end: number) { rows = rows.slice(start, Math.min(end + 1, start + (options.cap ?? 500))); return q; },
      maybeSingle() { return Promise.resolve(result(true)); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return q;
  } } as unknown as SupabaseClient;
  return { db, calls };
}

describe("Portfolio holdings authority", () => {
  it("uses manual official ready snapshots and scopes every position read", async () => {
    const { db, calls } = fixture();
    expect(await loadHoldings(db, "u")).toEqual({ state: "ready", snapshotId: "s", updatedAt: "2026-09-04", holdings: [{ code: "7203", name: "Toyota", tab: "holding" }] });
    for (const call of calls.filter((c) => c.table.endsWith("positions"))) expect(call.filters).toEqual([["user_id", "u"], ["portfolio_id", "p"], ["snapshot_id", "s"]]);
  });
  it("filters readiness and official scope before selecting latest, even after 21 failed imports", async () => {
    const snapshots = Array.from({ length: 21 }, (_, i) => ({ id: `f${i}`, portfolio_id: "p", portfolio_scope: "official", status: "failed", as_of: "2026-09-18" }));
    snapshots.push({ id: "reference", portfolio_id: "p", portfolio_scope: "external_reference", status: "ready", as_of: "2026-09-18" });
    snapshots.push({ id: "ready", portfolio_id: "p", portfolio_scope: "official", status: "ready", as_of: "2026-09-04" });
    expect((await selectReadySnapshot(fixture({ snapshots }).db, "p"))?.id).toBe("ready");
  });
  it("deduplicates accounts, excludes zero/foreign holdings and handles server row caps", async () => {
    const positions = [100, 200, 0].map((quantity, i) => ({ id: `x${i}`, user_id: "u", portfolio_id: "p", snapshot_id: "s", instrument_id: "i", quantity }));
    positions.push({ id: "foreign", user_id: "u", portfolio_id: "p", snapshot_id: "s", instrument_id: "f", quantity: 1 });
    const instruments = [{ id: "i", user_id: "u", asset_type: "domestic_stock", identifier: "7203", name: "Toyota" }, { id: "f", user_id: "u", asset_type: "foreign_stock", identifier: "AAPL", name: "Apple" }];
    expect((await loadHoldings(fixture({ positions, instruments, cap: 1 }).db, "u")).holdings).toHaveLength(1);
  });
  it("distinguishes missing portfolio, missing snapshot, and genuine empty holdings", async () => {
    expect((await loadHoldings(fixture({ portfolios: [] }).db, "u")).state).toBe("no_portfolio");
    expect((await loadHoldings(fixture({ snapshots: [] }).db, "u")).state).toBe("no_snapshot");
    expect(await loadHoldings(fixture({ positions: [] }).db, "u")).toMatchObject({ state: "ready", holdings: [] });
  });
  it("rejects incomplete references and changing snapshots", async () => {
    await expect(loadHoldings(fixture({ instruments: [] }).db, "u")).rejects.toThrow("reference");
    await expect(loadHoldings(fixture({ change: true }).db, "u")).rejects.toThrow("Snapshot changed");
    await expect(loadHoldings(fixture({ fail: "stock_notes_portfolio_positions" }).db, "u")).rejects.toThrow();
  });
  it("loads only this user's watch category", async () => {
    expect(await loadWatchCodes(fixture({ cap: 1 }).db, "u")).toEqual(["7203"]);
  });
  it("rejects malformed API payloads", () => {
    expect(isAudience({ holdings: unavailableHoldings(), watch: { state: "ready", codes: [] } })).toBe(true);
    expect(isAudience({ holdings: { ...unavailableHoldings(), state: "ready" }, watch: { state: "ready", codes: [] } })).toBe(false);
    expect(isAudience({ holdings: unavailableHoldings(), watch: { state: "ready", codes: [null] } })).toBe(false);
  });
});
