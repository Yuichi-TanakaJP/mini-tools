import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadAllWorkspaceCoreCurrentStateRows,
  loadAllWorkspaceCoreEvolutionRows,
  loadAllWorkspaceCoreWorkstreamRows,
} from "../control-center-read-pages";

type Row = Record<string, unknown>;
type Order = [string, { ascending: boolean; nullsFirst?: boolean }];
const specs = [
  {
    name: "Evolution",
    table: "workspace_core_evolution_summary_v",
    orders: [["event_id", { ascending: true }]] as Order[],
    load: loadAllWorkspaceCoreEvolutionRows,
  },
  {
    name: "Current State",
    table: "workspace_core_observability_current_v",
    orders: [
      ["source_key", { ascending: true }],
      ["subject_key", { ascending: true, nullsFirst: true }],
      ["metric_key", { ascending: true }],
    ] as Order[],
    load: loadAllWorkspaceCoreCurrentStateRows,
  },
  {
    name: "Workstream",
    table: "workspace_core_workstream_resume_v",
    orders: [["workstream_code", { ascending: true }]] as Order[],
    load: loadAllWorkspaceCoreWorkstreamRows,
  },
];

type Options = {
  cap?: number;
  count?: (call: number) => number | null;
  failAt?: number;
  emptyAt?: number;
};

function fixture(spec: (typeof specs)[number], size: number, options: Options = {}) {
  const rows: Row[] = Array.from({ length: size }, (_, index) => ({
    event_id: `event-${String(index).padStart(5, "0")}`,
    source_key: "source",
    subject_key: "subject",
    metric_key: `metric-${String(index).padStart(5, "0")}`,
    workstream_code: `work-${String(index).padStart(5, "0")}`,
    status: index === size - 1 ? "blocked" : "active",
  }));
  const ranges: Array<[number, number]> = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, spec.table);
      const orders: Order[] = [];
      let filtered = false;
      const query = {
        select(columns: string, selectOptions: unknown) {
          assert.deepEqual(selectOptions, { count: "exact" });
          assert.ok(!columns.split(",").includes("message"));
          assert.ok(!columns.includes("*"));
          return query;
        },
        in(column: string, values: string[]) {
          assert.equal(column, "status");
          assert.deepEqual(values, ["active", "blocked", "paused"]);
          filtered = true;
          return query;
        },
        order(column: string, orderOptions: Order[1]) {
          orders.push([column, orderOptions]);
          return query;
        },
        async range(from: number, to: number) {
          assert.deepEqual(orders, spec.orders);
          assert.equal(filtered, spec.name === "Workstream");
          ranges.push([from, to]);
          const call = ranges.length;
          if (options.failAt === call) {
            return { data: null, count: null, error: { message: "private database detail" } };
          }
          const data = options.emptyAt === call
            ? []
            : rows.slice(from, Math.min(to + 1, from + (options.cap ?? 1000)));
          return { data, count: options.count ? options.count(call) : size, error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { supabase, rows, ranges };
}

for (const spec of specs) {
  describe(`Control Center ${spec.name} pagination`, () => {
    it("reads row 1001 only after asserting a fixed unique order on every page", async () => {
      const f = fixture(spec, 1001);
      assert.deepEqual(await spec.load(f.supabase), f.rows);
      assert.deepEqual(f.ranges, [[0, 999], [1000, 1999]]);
    });

    it("does not mistake a lower server cap for the end of the collection", async () => {
      const f = fixture(spec, 1001, { cap: 250 });
      assert.deepEqual(await spec.load(f.supabase), f.rows);
      assert.deepEqual(f.ranges.map(([from]) => from), [0, 250, 500, 750, 1000]);
    });

    it("handles an empty projection", async () => {
      const f = fixture(spec, 0);
      assert.deepEqual(await spec.load(f.supabase), []);
      assert.deepEqual(f.ranges, [[0, 999]]);
    });

    it("stops at an exact full page without a request beyond the collection", async () => {
      const f = fixture(spec, 1000);
      assert.equal((await spec.load(f.supabase)).length, 1000);
      assert.deepEqual(f.ranges, [[0, 999]]);
    });

    it("stops after a short complete first page", async () => {
      const f = fixture(spec, 1);
      assert.deepEqual(await spec.load(f.supabase), f.rows);
      assert.deepEqual(f.ranges, [[0, 999]]);
    });
  });
}

describe("Control Center pagination failure boundary", () => {
  const spec = specs[0];
  it("rejects a missing exact count instead of claiming completeness", async () => {
    const f = fixture(spec, 1, { count: () => null });
    await assert.rejects(spec.load(f.supabase), /exact count unavailable/);
  });
  it("rejects count drift between pages", async () => {
    const f = fixture(spec, 1001, { count: (call) => call === 1 ? 1001 : 1002 });
    await assert.rejects(spec.load(f.supabase), /row count changed/);
  });
  it("rejects an empty page before the expected end", async () => {
    const f = fixture(spec, 1001, { emptyAt: 2 });
    await assert.rejects(spec.load(f.supabase), /incomplete page read/);
  });
  it("does not return a partial success or raw database error after a failed page", async () => {
    const f = fixture(spec, 1001, { failAt: 2 });
    await assert.rejects(spec.load(f.supabase), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /page read failed/);
      assert.ok(!error.message.includes("private database detail"));
      return true;
    });
  });
  it("rejects a page inconsistent with the exact total", async () => {
    const f = fixture(spec, 3, { count: () => 2 });
    await assert.rejects(spec.load(f.supabase), /inconsistent page size/);
  });
});
