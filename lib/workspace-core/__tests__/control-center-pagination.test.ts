import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllWorkspaceCoreEvolutionRows } from "../data";

describe("Control Center Evolution pagination", () => {
  it("reads every PostgREST page before semantic ranking", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      event_id: `old-${index}`,
      event_type: "milestone",
      title: `Old ${index}`,
      period_end: "2026-01-01",
    }));
    const secondPage = [
      {
        event_id: "newest",
        event_type: "pivot",
        title: "Newest",
        period_end: "2026-10-05",
      },
    ];

    const ranges: Array<[number, number]> = [];
    const pages = [firstPage, secondPage];

    const supabase = {
      from(table: string) {
        expect(table).toBe("workspace_core_evolution_summary_v");
        return {
          select() {
            return {
              async range(from: number, to: number) {
                ranges.push([from, to]);
                return { data: pages.shift() ?? [], error: null };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const rows = await loadAllWorkspaceCoreEvolutionRows(supabase);

    expect(rows).toHaveLength(1001);
    expect(rows.at(-1)).toMatchObject({ event_id: "newest" });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("stops after a short first page", async () => {
    const ranges: Array<[number, number]> = [];
    const supabase = {
      from() {
        return {
          select() {
            return {
              async range(from: number, to: number) {
                ranges.push([from, to]);
                return { data: [{ event_id: "one" }], error: null };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const rows = await loadAllWorkspaceCoreEvolutionRows(supabase);
    expect(rows).toHaveLength(1);
    expect(ranges).toEqual([[0, 999]]);
  });
});
