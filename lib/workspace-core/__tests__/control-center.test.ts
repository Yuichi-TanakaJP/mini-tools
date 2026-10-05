import { describe, expect, it } from "vitest";
import { buildWorkspaceCoreControlCenter, uniqueNonEmptyCount } from "../control-center";

describe("Workspace Core Control Center", () => {
  it("separates fact age from mirror delivery age and exposes source watermarks", () => {
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
          source_key: "source-fresh",
          metric_key: "healthy",
          status: "ok",
          observed_at: "2026-09-25T18:25:36Z",
          mirrored_at: "2026-10-04T23:00:00Z",
        },
        {
          source_key: "source-stale",
          metric_key: "failed",
          status: "critical",
          observed_at: "2026-09-25T18:25:36Z",
          mirrored_at: "2026-09-26T00:00:00Z",
          message: "this raw field must never be projected",
        },
        {
          source_key: "source-stale",
          metric_key: "unknown",
          status: "unknown",
          observed_at: "2026-09-25T18:00:00Z",
          mirrored_at: "2026-09-26T00:00:00Z",
        },
      ],
      eventRows: [
        {
          event_id: "e1",
          source_key: "source-stale",
          metric_key: "failed",
          previous_status: "ok",
          new_status: "critical",
          observed_at: "2026-09-25T18:25:36Z",
          mirrored_at: "2026-09-26T00:00:00Z",
          message: "raw event detail",
        },
      ],
      evolutionRows: [
        {
          event_id: "ev1",
          event_type: "pivot",
          title: "A confirmed change",
          summary: "meaning",
          period_start: "2026-09-28",
          period_end: "2026-09-28",
          source: "conversation:test",
          confidence: 1,
          verified_at: "2026-09-28T00:00:00Z",
          updated_at: "2026-09-28T00:00:00Z",
        },
      ],
      architecture: { products: 19, repositories: 21, services: 3 },
    });

    expect(result.work.items.map((item) => item.code)).toEqual(["blocked-a", "active-a"]);
    expect(result.operations.latestObservedAt).toBe("2026-09-25T18:25:36.000Z");
    expect(result.operations.latestMirroredAt).toBe("2026-10-04T23:00:00.000Z");
    expect(result.operations.observationAgeHours).toBeGreaterThan(24);
    expect(result.operations.mirrorDeliveryStale).toBe(false);

    const staleSource = result.operations.sourceCoverage.find(
      (item) => item.sourceKey === "source-stale",
    );
    expect(staleSource?.mirrorDeliveryAgeHours).toBeGreaterThan(24);
    expect(staleSource?.attentionCount).toBe(2);

    expect(result.operations.attention.map((item) => item.status)).toEqual([
      "critical",
      "unknown",
    ]);
    expect(result.operations.attention[0]).not.toHaveProperty("message");
    expect(result.operations.recentEvents[0]).not.toHaveProperty("message");
    expect(result.evolution.items[0]).toMatchObject({
      eventId: "ev1",
      eventType: "pivot",
      title: "A confirmed change",
      source: "conversation:test",
    });
  });

  it("marks the mirror stale when no remote row has been delivered for 24 hours", () => {
    const result = buildWorkspaceCoreControlCenter({
      now: new Date("2026-10-05T00:00:00Z"),
      workstreamRows: [],
      currentRows: [
        {
          source_key: "svc",
          metric_key: "healthy",
          status: "ok",
          observed_at: "2026-10-04T23:30:00Z",
          mirrored_at: "2026-10-03T12:00:00Z",
        },
      ],
      eventRows: [],
      evolutionRows: [],
      architecture: {
        products: uniqueNonEmptyCount(
          [{ product_id: "p1" }, { product_id: "p1" }, { product_id: "p2" }],
          "product_id",
        ),
        repositories: uniqueNonEmptyCount(
          [{ repository_id: "r1" }, { repository_id: "r2" }],
          "repository_id",
        ),
        services: uniqueNonEmptyCount([{ service_id: "s1" }], "service_id"),
      },
    });

    expect(result.operations.observationAgeHours).toBeLessThan(1);
    expect(result.operations.mirrorDeliveryStale).toBe(true);
    expect(result.architecture).toEqual({ products: 2, repositories: 2, services: 1 });
  });
});
