import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readCompleteRows } from "../pagination";
import { fetchStocks, fetchAnalyses, fetchTheses, fetchOpenActions } from "../data";

function cappedClient(rows: Record<string, unknown>[], cap = 2) {
  const offsets: number[] = [];
  const client = { from: () => {
    let offset = 0;
    const query = {
      select: (_columns: string, options: unknown) => { expect(options).toEqual({ count: "exact" }); return query; },
      order: (column: string, options: unknown) => { expect([column, options]).toEqual(["id", { ascending: true }]); return query; },
      range: (start: number) => { offset = start; offsets.push(start); return query; },
      eq: (column: string, value: string) => { expect([column, value]).toEqual(["status", "open"]); return query; },
      returns: async () => ({ data: rows.slice(offset, offset + cap), count: rows.length, error: null }),
    }; return query;
  } } as unknown as SupabaseClient;
  return { client, offsets };
}
const rows = Array.from({ length: 5 }, (_, index) => ({ id: `id${index}`, code: "1234", name: "Example", category: "watch", watch_purposes: [], credit_monitoring_enabled: null, stock_id: "s1", status: "open" }));

describe("complete stock dashboard reads", () => {
  it.each([fetchStocks, fetchAnalyses, fetchTheses, fetchOpenActions])("pages capped stocks and every child table through %s", async (fetchRows) => {
    const { client, offsets } = cappedClient(rows);
    expect(await fetchRows(client)).toHaveLength(5);
    expect(offsets).toEqual([0, 2, 4]);
  });
  it("accepts a verified genuine empty table", async () => {
    expect(await readCompleteRows(cappedClient([]).client, "stocks", "id")).toEqual([]);
  });
  it.each([
    [{ data: [], count: null, error: null }],
    [{ data: [], count: 1, error: null }],
    [{ data: [{ id: "a" }], count: 2, error: null }, { data: [], count: 2, error: null }],
    [{ data: [{ id: "a" }], count: 2, error: null }, { data: [{ id: "b" }], count: 3, error: null }],
    [{ data: [{ id: "a" }], count: 2, error: null }, { data: [{ id: "a" }], count: 2, error: null }],
  ])("rejects missing count, early end, changed count, and duplicated pages %j", async (...pages) => {
    let index = 0;
    const query = { select: () => query, order: () => query, range: () => query, returns: async () => pages[index++] };
    await expect(readCompleteRows({ from: () => query } as unknown as SupabaseClient, "stocks", "id")).rejects.toThrow();
  });
});
