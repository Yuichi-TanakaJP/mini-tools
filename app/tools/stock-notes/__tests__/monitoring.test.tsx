import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStocks, updateStockMonitoring } from "../data";
import { monitoringLabel, parseMonitoringMetadata } from "../monitoring";
import StockMonitoringEditor from "../StockMonitoringEditor";

const metadata = { watchPurposes: ["growth", "shareholder_benefit"] as const, creditMonitoringEnabled: true };

describe("stock monitoring metadata", () => {
  it("keeps multiple purposes and all three explicit preference states", () => {
    for (const value of [null, true, false]) {
      expect(parseMonitoringMetadata(["growth", "shareholder_benefit"], value)).toEqual({ watchPurposes: ["growth", "shareholder_benefit"], creditMonitoringEnabled: value });
    }
    expect(monitoringLabel(null)).toBe("信用残：未指定");
    expect(monitoringLabel(false)).toBe("信用残：対象外");
    expect(monitoringLabel(true)).toBe("信用残：対象");
  });
  it.each([false, null, "growth", ["unknown"], ["growth", "growth"]])("rejects malformed purposes %j", (purposes) => {
    expect(() => parseMonitoringMetadata(purposes, false)).toThrow();
  });
  it.each(["false", 0, 1, {}, undefined])("rejects malformed monitoring %j rather than treating it as OFF", (credit) => {
    expect(() => parseMonitoringMetadata([], credit)).toThrow();
  });
  it("reads metadata through the full-table fallback", async () => {
    const raw = { id: "s1", code: "1234", name: "Example", category: "watch", category_changed_at: null, category_change_reason: "preserved", watch_purposes: ["growth"], credit_monitoring_enabled: false, created_at: "2026-01-01", updated_at: "2026-01-01" };
    const client = { from: () => ({ select: () => ({ returns: async () => ({ data: [raw], error: null }) }) }) } as unknown as SupabaseClient;
    expect(await fetchStocks(client)).toMatchObject([{ watchPurposes: ["growth"], creditMonitoringEnabled: false, categoryChangeReason: "preserved" }]);
    raw.credit_monitoring_enabled = "false" as never;
    await expect(fetchStocks(client)).rejects.toThrow("信用残監視");
  });
  it("writes only monitoring metadata and timestamp, scoped to owner and stock", async () => {
    const values: Record<string, unknown>[] = [];
    const filters: unknown[][] = [];
    const query = { eq: (key: string, value: string) => { filters.push([key, value]); return query; }, select: () => query, maybeSingle: async () => ({ data: { id: "s1" }, error: null }) };
    const client = { from: (table: string) => { expect(table).toBe("stock_notes_stocks"); return { update: (value: Record<string, unknown>) => { values.push(value); return query; } }; } } as unknown as SupabaseClient;
    await updateStockMonitoring(client, "owner", "s1", { watchPurposes: [...metadata.watchPurposes], creditMonitoringEnabled: true });
    expect(Object.keys(values[0]).sort()).toEqual(["credit_monitoring_enabled", "updated_at", "watch_purposes"]);
    expect(values[0].watch_purposes).toEqual(["growth", "shareholder_benefit"]);
    expect(values[0].credit_monitoring_enabled).toBe(true);
    expect(Number.isFinite(Date.parse(String(values[0].updated_at)))).toBe(true);
    expect(filters).toEqual([["id", "s1"], ["user_id", "owner"]]);
  });
  it("rejects a zero-row owner-filtered update", async () => {
    const query = { eq: () => query, select: () => query, maybeSingle: async () => ({ data: null, error: null }) };
    const client = { from: () => ({ update: () => query }) } as unknown as SupabaseClient;
    await expect(updateStockMonitoring(client, "owner", "s1", { watchPurposes: [], creditMonitoringEnabled: null })).rejects.toThrow("更新対象");
  });
  it("rejects invalid input before any DB write", async () => {
    const from = vi.fn();
    await expect(updateStockMonitoring({ from } as unknown as SupabaseClient, "owner", "s1", { watchPurposes: ["invalid"] as never, creditMonitoringEnabled: false })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("renders an accessible multi-purpose form and preserves archived exclusion explanation", () => {
    const html = renderToStaticMarkup(<StockMonitoringEditor initial={{ watchPurposes: ["growth", "shareholder_benefit"], creditMonitoringEnabled: false }} archived busy={false} onSave={async () => {}} />);
    expect(html).toContain('aria-label="注目目的・信用残監視"');
    expect((html.match(/checked=""/g) ?? []).length).toBe(2);
    expect(html).toContain('value="off" selected=""');
    expect(html).toContain("新規調査の銘柄も含み");
    expect(html).toContain("アーカイブのため");
    expect(html).toContain("注目目的・監視設定を保存");
  });
});
