import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_REVIEW_LIMIT,
  TDNET_ATTENTION_STATUSES,
  loadTdnetReviewQueue,
  parseReviewLimit,
  parseTdnetAttentionStatus,
  parseTdnetEventType,
  type TdnetAttentionStatus,
  type TdnetEventType,
} from "./data";

type QueryLog =
  | { op: "from"; value: string }
  | { op: "select"; value: string; count?: string }
  | { op: "eq"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }
  | { op: "order"; column: string; ascending: boolean }
  | { op: "limit"; value: number };

class QueryStub {
  constructor(
    private readonly log: QueryLog[],
    private readonly result: {
      data: unknown[];
      error: unknown;
      count: number | null;
    },
  ) {}

  select(columns: string, options?: { count?: string }) {
    this.log.push({ op: "select", value: columns, count: options?.count });
    return this;
  }

  eq(column: string, value: unknown) {
    this.log.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.log.push({ op: "in", column, value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.log.push({ op: "order", column, ascending: options.ascending });
    return this;
  }

  limit(value: number) {
    this.log.push({ op: "limit", value });
    return this;
  }

  returns() {
    return Promise.resolve(this.result);
  }
}

function stubClient(
  log: QueryLog[],
  result = { data: [], error: null, count: 0 },
) {
  return {
    from(table: string) {
      log.push({ op: "from", value: table });
      return new QueryStub(log, result);
    },
  } as unknown as SupabaseClient;
}

describe("TDNET Router review queue loader", () => {
  it("本人scope・attention status・新しい順をread-only feedへ適用する", async () => {
    const log: QueryLog[] = [];
    const data = await loadTdnetReviewQueue(
      stubClient(log),
      "user-1",
    );

    expect(data).toMatchObject({
      items: [],
      totalCount: 0,
      routeStatus: null,
      eventType: null,
      limit: DEFAULT_REVIEW_LIMIT,
    });
    expect(log[0]).toEqual({
      op: "from",
      value: "stock_notes_tdnet_hot_event_feed_v",
    });
    expect(log).toContainEqual({
      op: "eq",
      column: "user_id",
      value: "user-1",
    });
    expect(log).toContainEqual({
      op: "in",
      column: "route_status",
      value: [...TDNET_ATTENTION_STATUSES],
    });
    expect(log).toContainEqual({
      op: "order",
      column: "disclosed_at",
      ascending: false,
    });
    expect(log).toContainEqual({
      op: "order",
      column: "tdnet_disclosure_id",
      ascending: false,
    });
    expect(log).toContainEqual({
      op: "order",
      column: "event_type",
      ascending: true,
    });
    expect(log).toContainEqual({
      op: "limit",
      value: DEFAULT_REVIEW_LIMIT,
    });
  });

  it("明示status/event filterとDB countを返す", async () => {
    const log: QueryLog[] = [];
    const data = await loadTdnetReviewQueue(
      stubClient(log, {
        data: [
          {
            source_date: "2026-09-20",
            tdnet_disclosure_id: "140120260920000001",
            security_id: "security-1",
            security_code: "7203",
            source_security_code: "72030",
            disclosed_at: "2026-09-20T06:00:00Z",
            title: "配当予想の修正",
            event_type: "dividend_change",
            policy_version: "tdnet-refresh-policy-v1",
            route_status: "review_required",
            processed_at: null,
            ingested_at: "2026-09-20T06:01:00Z",
            pdf_url: "https://example.test/a.pdf",
            company_listing_id: "listing-1",
            company_entity_id: "company-1",
            company_name: "テスト自動車",
          },
        ],
        error: null,
        count: 12,
      }),
      "user-1",
      {
        routeStatus: "review_required",
        eventType: "dividend_change",
        limit: 25,
      },
    );

    expect(data.totalCount).toBe(12);
    expect(data.items).toHaveLength(1);
    expect(log).toContainEqual({
      op: "in",
      column: "route_status",
      value: ["review_required"],
    });
    expect(log).toContainEqual({
      op: "eq",
      column: "event_type",
      value: "dividend_change",
    });
    expect(log).toContainEqual({ op: "limit", value: 25 });
  });

  it("URL filterは未知値を安全にdefaultへ戻す", () => {
    expect(parseTdnetAttentionStatus("failed")).toBe("failed");
    expect(parseTdnetAttentionStatus("unknown")).toBeNull();
    expect(parseTdnetEventType("earnings_release")).toBe("earnings_release");
    expect(parseTdnetEventType("unknown")).toBeNull();
    expect(parseReviewLimit("25")).toBe(25);
    expect(parseReviewLimit("999")).toBe(DEFAULT_REVIEW_LIMIT);
  });

  it("loader直呼びの不正status/event/limitを拒否する", async () => {
    const db = stubClient([]);

    await expect(
      loadTdnetReviewQueue(db, "user-1", {
        routeStatus: "applied" as TdnetAttentionStatus,
      }),
    ).rejects.toThrow("unsupported TDNET route_status");

    await expect(
      loadTdnetReviewQueue(db, "user-1", {
        eventType: "governance" as TdnetEventType,
      }),
    ).rejects.toThrow("unsupported TDNET event_type");

    await expect(
      loadTdnetReviewQueue(db, "user-1", { limit: 201 }),
    ).rejects.toThrow("TDNET review limit");
  });
});
