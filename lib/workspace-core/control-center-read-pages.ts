import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Page = {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
};

const PAGE_SIZE = 1000;

// Only the fixed loaders below supply queries. No request-selected relation or column.
async function readAllPages(
  label: string,
  loadPage: (from: number, to: number) => PromiseLike<Page>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let expectedCount: number | null = null;

  for (;;) {
    const result = await loadPage(rows.length, rows.length + PAGE_SIZE - 1);
    // Do not propagate raw database errors into the route's error logger.
    if (result.error) throw new Error(`${label}: page read failed`);
    const count = result.count;
    if (count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${label}: exact count unavailable`);
    }
    if (expectedCount !== null && count !== expectedCount) {
      throw new Error(`${label}: row count changed during pagination; retry`);
    }
    expectedCount = count;

    const page = result.data ?? [];
    if (page.length > PAGE_SIZE || rows.length + page.length > count) {
      throw new Error(`${label}: inconsistent page size`);
    }
    if (page.length === 0 && rows.length < count) {
      throw new Error(`${label}: incomplete page read`);
    }
    rows.push(...page);
    if (rows.length === count) return rows;
    // Advance by actual returned rows: a server cap may be lower than PAGE_SIZE.
    // Separate HTTP reads are NOT a transactionally consistent DB snapshot.
  }
}

export function loadAllWorkspaceCoreEvolutionRows(
  supabase: SupabaseClient,
): Promise<Row[]> {
  return readAllPages("Control Center Evolution", (from, to) =>
    supabase
      .from("workspace_core_evolution_summary_v")
      .select(
        "event_id,event_type,title,summary,period_start,period_end,time_precision,source,confidence,verified_at,updated_at",
        { count: "exact" },
      )
      .order("event_id", { ascending: true })
      .range(from, to),
  );
}

export function loadAllWorkspaceCoreCurrentStateRows(
  supabase: SupabaseClient,
): Promise<Row[]> {
  return readAllPages("Control Center Current State", (from, to) =>
    supabase
      .from("workspace_core_observability_current_v")
      .select(
        "source_key,subject_key,metric_key,status,observed_at,mirrored_at,subject_kind,subject_label,product_slug,metric_label,reason_code,usage_ratio,limit_needs_review",
        { count: "exact" },
      )
      .order("source_key", { ascending: true })
      .order("subject_key", { ascending: true, nullsFirst: true })
      .order("metric_key", { ascending: true })
      .range(from, to),
  );
}

export function loadAllWorkspaceCoreWorkstreamRows(
  supabase: SupabaseClient,
): Promise<Row[]> {
  return readAllPages("Control Center Workstream", (from, to) =>
    supabase
      .from("workspace_core_workstream_resume_v")
      .select(
        "workstream_code,workstream_title,status,current_phase,progress_pct,current_summary,next_actions,blockers,workstream_updated_at,last_update_at,last_update_type,last_update_summary",
        { count: "exact" },
      )
      .in("status", ["active", "blocked", "paused"])
      .order("workstream_code", { ascending: true })
      .range(from, to),
  );
}
