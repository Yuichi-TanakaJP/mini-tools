import { describe, expect, it } from "vitest";
import { buildWorkspaceCoreControlCenter, uniqueNonEmptyCount } from "../control-center";

describe("Workspace Core Control Center", () => {
  it("surfaces blocked work first and marks an old observability mirror stale", () => {
    const result = buildWorkspaceCoreControlCenter({
      now: new Date("2026-10-05T00:00:00Z"),
      workstreamRows: [
        {
          workstream_code: "active-a",
          workstream_title: "Active A",
          status: "active",
          blockers: [],
          next_actions: ["next"],
          last_update_at: "2026-10-04T00:00:00Z",
        },
        {
          workstream_code: "blocked-a",
          workstream_title: "Blocked A",
          status: "blocked",
          blockers: ["waiting"],
          next_actions: [],
          last_update_at: "2026-10-03T00:00:00Z",
        },
      ],
      currentRows: [
        {
          source_key: "svc",
          metric_key: "healthy",
          status: "ok",
          observed_at: "2026-09-25T18:25:36Z",
        },
        {
          source_key: "svc",
          metric_key: "failed",
          status: "critical",
          observed_at: "2026-09-25T18:25:36Z",
          message: "this raw field must never be projected",
        },
        {
          source_key: "svc",
          metric_key: "unknown",
          status: "unknown",
          observed_at: "2026-09-25T18:00:00Z",
        },
      ],
      eventRows: [
        {
          event_id: "e1",
          source_key: "svc",
          metric_key: "failed",
          previous_status: "ok",
          new_status: "critical",
          observed_at: "2026-09-25T18:25:36Z",
          message: "raw event detail",
        },
      ],
      architecture: { products: 19, repositories: 21, services: 3 },
    });

    expect(result.work.items.map((item) => item.code)).toEqual(["blocked-a", "active-a"]);
    expect(result.work.blockedCount).toBe(1);
    expect(result.operations.counts).toEqual({
      ok: 1,
      warning: 0,
      critical: 1,
      unknown: 1,
      other: 0,
    });
    expect(result.operations.stale).toBe(true);
    expect(result.operations.lastObservedAt).toBe("2026-09-25T18:25:36.000Z");
    expect(result.operations.attention.map((item) => item.status)).toEqual(["critical", "unknown"]);
    expect(result.operations.attention[0]).not.toHaveProperty("message");
    expect(result.operations.recentEvents[0]).not.toHaveProperty("message");
  });

  it("does not mark a fresh mirror stale and counts unique architecture identities", () => {
    const result = buildWorkspaceCoreControlCenter({
      now: new Date("2026-10-05T00:00:00Z"),
      workstreamRows: [],
      currentRows: [
        {
          source_key: "svc",
          metric_key: "healthy",
          status: "ok",
          observed_at: "2026-10-04T12:30:00Z",
        },
      ],
      eventRows: [],
      architecture: {
        products: uniqueNonEmptyCount([{ product_id: "p1" }, { product_id: "p1" }, { product_id: "p2" }], "product_id"),
        repositories: uniqueNonEmptyCount([{ repository_id: "r1" }, { repository_id: "r2" }], "repository_id"),
        services: uniqueNonEmptyCount([{ service_id: "s1" }], "service_id"),
      },
    });

    expect(result.operations.stale).toBe(false);
    expect(result.architecture).toEqual({ products: 2, repositories: 2, services: 1 });
  });
});
