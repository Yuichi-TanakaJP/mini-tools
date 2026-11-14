import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { updateStockMonitoring } from "../data";
import { monitoringLabel, parseMonitoringMetadata } from "../monitoring";
import StockMonitoringEditor from "../StockMonitoringEditor";

const baseline = { watchPurposes: [], creditMonitoringEnabled: null, updatedAt: "2026-01-01T00:00:00.000Z" };
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
  it("writes only monitoring metadata and timestamp, scoped to owner and stock", async () => {
    const values: Record<string, unknown>[] = [];
    const filters: unknown[][] = [];
    const query = { eq: (key: string, value: string) => { filters.push([key, value]); return query; }, is: (key: string, value: null) => { filters.push([key, value]); return query; }, select: () => query, maybeSingle: async () => ({ data: { id: "s1" }, error: null }) };
    const client = { from: (table: string) => { expect(table).toBe("stock_notes_stocks"); return { update: (value: Record<string, unknown>) => { values.push(value); return query; } }; } } as unknown as SupabaseClient;
    await updateStockMonitoring(client, "owner", "s1", { watchPurposes: [...metadata.watchPurposes], creditMonitoringEnabled: true }, baseline);
    expect(Object.keys(values[0]).sort()).toEqual(["credit_monitoring_enabled", "updated_at", "watch_purposes"]);
    expect(values[0].watch_purposes).toEqual(["growth", "shareholder_benefit"]);
    expect(values[0].credit_monitoring_enabled).toBe(true);
    expect(Number.isFinite(Date.parse(String(values[0].updated_at)))).toBe(true);
    expect(filters).toEqual([["id", "s1"], ["user_id", "owner"], ["updated_at", baseline.updatedAt], ["watch_purposes", "{}"], ["credit_monitoring_enabled", null]]);
  });
  it("rejects a zero-row owner-filtered update", async () => {
    const query = { eq: () => query, is: () => query, select: () => query, maybeSingle: async () => ({ data: null, error: null }) };
    const client = { from: () => ({ update: () => query }) } as unknown as SupabaseClient;
    await expect(updateStockMonitoring(client, "owner", "s1", { watchPurposes: [], creditMonitoringEnabled: null }, baseline)).rejects.toThrow("更新対象");
  });
  it("rejects invalid input before any DB write", async () => {
    const from = vi.fn();
    await expect(updateStockMonitoring({ from } as unknown as SupabaseClient, "owner", "s1", { watchPurposes: ["invalid"] as never, creditMonitoringEnabled: false }, baseline)).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("renders an accessible multi-purpose form and preserves archived exclusion explanation", () => {
    const html = renderToStaticMarkup(<StockMonitoringEditor initial={{ watchPurposes: ["growth", "shareholder_benefit"], creditMonitoringEnabled: false, updatedAt: baseline.updatedAt }} archived busy={false} onSave={async () => {}} />);
    expect(html).toContain('aria-label="注目目的・信用残監視"');
    expect((html.match(/checked=""/g) ?? []).length).toBe(2);
    expect(html).toContain('value="off" selected=""');
    expect(html).toContain("新規調査の銘柄も含み");
    expect(html).toContain("アーカイブのため");
    expect(html).toContain("注目目的・監視設定を保存");
  });
});


it.each([false, true])("prevents two editors changing different fields from overwriting each other, credit first=%s", async (creditFirst) => {
  let stored = { watch_purposes: [] as string[], credit_monitoring_enabled: null as boolean | null, updated_at: baseline.updatedAt };
  const client = { from: () => ({ update: (values: typeof stored) => {
    const filters: [string, unknown][] = [];
    const query = { eq: (key: string, value: unknown) => { filters.push([key, value]); return query; }, is: (key: string, value: unknown) => { filters.push([key, value]); return query; }, select: () => query,
      maybeSingle: async () => {
        const matches = filters.every(([key, value]) => key === "id" || key === "user_id" || (key === "watch_purposes" ? value === `{${stored.watch_purposes.join(",")}}` : stored[key as keyof typeof stored] === value));
        if (!matches) return { data: null, error: null };
        stored = { ...values }; return { data: { id: "s1" }, error: null };
      } }; return query;
  } }) } as unknown as SupabaseClient;
  const purposeEdit = { watchPurposes: ["dividend"] as const, creditMonitoringEnabled: null };
  const creditEdit = { watchPurposes: [], creditMonitoringEnabled: false };
  const first = creditFirst ? creditEdit : { ...purposeEdit, watchPurposes: [...purposeEdit.watchPurposes] };
  const stale = creditFirst ? { ...purposeEdit, watchPurposes: [...purposeEdit.watchPurposes] } : creditEdit;
  await updateStockMonitoring(client, "owner", "s1", first, baseline);
  const afterFirst = { ...stored };
  await expect(updateStockMonitoring(client, "owner", "s1", stale, baseline)).rejects.toThrow("他の画面");
  expect(stored).toEqual(afterFirst);
  expect(stored.credit_monitoring_enabled).toBe(creditFirst ? false : null);
  expect(stored.watch_purposes).toEqual(creditFirst ? [] : ["dividend"]);
});


it.each([null, true, false])("serializes CAS filters with the real Supabase SDK for original flag %s", async (flag) => {
  let captured: { url: URL; init: RequestInit } | undefined;
  const client = createClient("https://example.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      captured = { url: new URL(String(input)), init: init ?? {} };
      return new Response(JSON.stringify({ id: "s1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  await updateStockMonitoring(client, "owner", "s1", { watchPurposes: ["dividend"], creditMonitoringEnabled: true }, { ...baseline, watchPurposes: ["growth"], creditMonitoringEnabled: flag });
  expect(captured?.init.method).toBe("PATCH");
  expect(captured?.url.searchParams.get("id")).toBe("eq.s1");
  expect(captured?.url.searchParams.get("user_id")).toBe("eq.owner");
  expect(captured?.url.searchParams.get("updated_at")).toBe(`eq.${baseline.updatedAt}`);
  expect(captured?.url.searchParams.get("watch_purposes")).toBe("eq.{growth}");
  expect(captured?.url.searchParams.get("credit_monitoring_enabled")).toBe(flag === null ? "is.null" : `eq.${flag}`);
  expect(Object.keys(JSON.parse(String(captured?.init.body))).sort()).toEqual(["credit_monitoring_enabled", "updated_at", "watch_purposes"]);
});
