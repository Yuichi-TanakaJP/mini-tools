import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkspaceCoreControlCenterV2 } from "../data";

type Result = { data: Record<string, unknown> | null; error: { message: string } | null };

const validRows: Record<string, Record<string, unknown>> = {
  workspace_core_control_center_work_v2: {
    active_count: 0,
    blocked_count: 0,
    paused_count: 0,
    eligible_total: 0,
    items: [],
  },
  workspace_core_control_center_operations_v2: {
    ok_count: 0,
    warning_count: 0,
    critical_count: 0,
    unknown_count: 0,
    other_count: 0,
    total_count: 0,
    attention_eligible_total: 0,
    attention_items: [],
    event_eligible_total: 0,
    recent_event_items: [],
    source_eligible_total: 0,
    as_of_observed_at: null,
    as_of_delivered_at: null,
    delivery_basis: "not_applicable",
    source_coverage_items: [],
  },
  workspace_core_control_center_evolution_v2: {
    eligible_total: 0,
    items: [],
  },
  workspace_core_control_center_architecture_v2: {
    products: 0,
    repositories: 0,
    services: 0,
  },
};

function clientWithFailures(failedTables: Set<string>): SupabaseClient {
  return {
    from(table: string) {
      return {
        select() {
          return {
            async single(): Promise<Result> {
              if (failedTables.has(table)) {
                return {
                  data: null,
                  error: { message: `private database detail for ${table}` },
                };
              }
              return { data: validRows[table] ?? null, error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("Control Center V2 provider failure boundary", () => {
  it("escalates four failed fixed reads to a top-level provider failure", async () => {
    const allTables = new Set(Object.keys(validRows));

    await expect(
      loadWorkspaceCoreControlCenterV2(
        clientWithFailures(allTables),
        new Date("2026-10-06T00:00:00Z"),
      ),
    ).rejects.toThrow("Control Center V2 provider unavailable");
  });

  it("keeps an isolated section failure as a degraded V2 response", async () => {
    const result = await loadWorkspaceCoreControlCenterV2(
      clientWithFailures(new Set(["workspace_core_control_center_work_v2"])),
      new Date("2026-10-06T00:00:00Z"),
    );

    expect(result.status).toBe("degraded");
    expect(result.data.work.state).toBe("unavailable");
    expect(result.data.work.issueCodes).toEqual(["SOURCE_UNAVAILABLE"]);
    expect(result.data.operations.state).toBe("available");
    expect(result.data.evolution.state).toBe("available");
    expect(result.data.architecture.state).toBe("available");
  });
});
