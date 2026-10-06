import { describe, expect, it } from "vitest";
import {
  buildWorkspaceCoreControlCenterV2,
  buildWorkspaceCoreControlCenterV2Error,
  type WorkspaceCoreControlCenterV2SectionResult,
} from "../control-center-v2";

function successFixtures() {
  const work: WorkspaceCoreControlCenterV2SectionResult = {
    unavailable: false,
    data: {
      active_count: 1,
      blocked_count: 0,
      paused_count: 0,
      eligible_total: 1,
      items: [
        {
          code: "workspace-core",
          title: "Workspace Core",
          status: "active",
          phase: "slice-1a",
          progressPct: 85,
          summary: "Additive V2 provider",
          nextActions: {
            items: ["Implement provider"],
            total: 1,
            returned: 1,
            limit: 5,
            truncated: false,
          },
          blockers: {
            items: [],
            total: 0,
            returned: 0,
            limit: 5,
            truncated: false,
          },
          updatedAt: "2026-10-05T23:00:00Z",
          lastUpdateAt: "2026-10-05T23:30:00Z",
          lastUpdateType: "status_change",
          lastUpdateSummary: "Slice 1A GO",
        },
      ],
    },
  };

  const operations: WorkspaceCoreControlCenterV2SectionResult = {
    unavailable: false,
    data: {
      ok_count: 1,
      warning_count: 0,
      critical_count: 0,
      unknown_count: 0,
      other_count: 0,
      total_count: 1,
      attention_eligible_total: 0,
      attention_items: [],
      event_eligible_total: 1,
      recent_event_items: [
        {
          eventId: "event-1",
          sourceKey: "source-a",
          subjectKey: null,
          metricKey: "health",
          previousStatus: "unknown",
          newStatus: "ok",
          observedAt: "2026-10-05T20:00:00Z",
          deliveredAt: "2026-10-05T20:01:00Z",
          subjectLabel: null,
          metricLabel: "Health",
          productSlug: null,
          reasonCode: null,
          eventKind: "transition",
        },
      ],
      source_eligible_total: 1,
      as_of_observed_at: "2026-10-05T20:00:00Z",
      as_of_delivered_at: "2026-10-05T20:01:00Z",
      delivery_basis: "row_timestamp_proxy",
      source_coverage_items: [
        {
          sourceKey: "source-a",
          rowCount: 1,
          attentionCount: 0,
          lastObservedAt: "2026-10-05T20:00:00Z",
          lastDeliveredAt: "2026-10-05T20:01:00Z",
          observationVerdict: "unknown",
          deliveryVerdict: "unknown",
          deliveryBasis: "row_timestamp_proxy",
          observationPolicyVersion: null,
          deliveryPolicyVersion: null,
        },
      ],
    },
  };

  const evolution: WorkspaceCoreControlCenterV2SectionResult = {
    unavailable: false,
    data: {
      eligible_total: 1,
      items: [
        {
          eventId: "evolution-1",
          eventType: "workflow_changed",
          title: "V2 design complete",
          summary: "Slice 1A only",
          periodStart: "2026-10-06",
          periodEnd: "2026-10-06",
          timePrecision: "day",
          source: "github:workspace-core#19",
          confidence: 1,
          verifiedAt: "2026-10-06T00:00:00Z",
          updatedAt: "2026-10-06T00:00:00Z",
        },
      ],
    },
  };

  const architecture: WorkspaceCoreControlCenterV2SectionResult = {
    unavailable: false,
    data: { products: 19, repositories: 21, services: 3 },
  };

  return { work, operations, evolution, architecture };
}

describe("Control Center Summary V2 contract", () => {
  it("builds the exact V2 envelope from bounded provider rows", () => {
    const result = buildWorkspaceCoreControlCenterV2({
      ...successFixtures(),
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(result).toMatchObject({
      status: "ok",
      contract: "workspace-core.control-center-summary",
      version: "2.0",
      generatedAt: "2026-10-06T00:00:00.000Z",
    });
    expect(result.data.work.workstreams.meta).toEqual({
      completeness: "ranked_top_n",
      limit: 12,
      eligibleTotal: 1,
      returned: 1,
    });
    expect(result.data.work.workstreams.items[0].nextActions).toEqual({
      items: ["Implement provider"],
      total: 1,
      returned: 1,
      limit: 5,
      truncated: false,
    });
    expect(result.data.operations.state).toBe("available");
    expect(result.data.operations.issueCodes).toEqual([
      "TRANSITIONAL_DELIVERY_PROXY",
    ]);
    expect(result.data.operations.freshness.observation).toMatchObject({
      verdict: "unknown",
      policyVersion: null,
    });
    expect(result.data.operations.freshness.observation.ageHours).toBe(4);
    expect(result.data.operations.freshness.delivery.ageHours).toBeCloseTo(
      3.9833333333,
    );
    expect(result.data.operations.attention.meta.completeness).toBe(
      "ranked_top_n",
    );
    expect(result.data.operations.recentEvents.meta).toMatchObject({
      completeness: "ranked_top_n",
      limit: 12,
      eligibleTotal: 1,
      returned: 1,
    });
    expect(result.data.operations.sourceCoverage.items[0]).toMatchObject({
      sourceKey: "source-a",
      observationAgeHours: 4,
      observationVerdict: "unknown",
      deliveryVerdict: "unknown",
      deliveryBasis: "row_timestamp_proxy",
    });
    expect(result.data.evolution.events.meta).toMatchObject({
      completeness: "ranked_top_n",
      eligibleTotal: 1,
      returned: 1,
    });
    expect(result.data.architecture.counts).toEqual({
      products: 19,
      repositories: 21,
      services: 3,
    });
  });

  it("keeps a legitimate empty Operations source set distinct from failure", () => {
    const fixtures = successFixtures();
    fixtures.operations.data = {
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
    };

    const result = buildWorkspaceCoreControlCenterV2({
      ...fixtures,
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(result.status).toBe("ok");
    expect(result.data.operations.state).toBe("available");
    expect(result.data.operations.issueCodes).toEqual([]);
    expect(result.data.operations.counts.total).toBe(0);
    expect(result.data.operations.sourceCoverage.meta).toEqual({
      completeness: "ranked_top_n",
      limit: 64,
      eligibleTotal: 0,
      returned: 0,
    });
    expect(result.data.operations.freshness.delivery).toEqual({
      ageHours: null,
      verdict: "not_applicable",
      basis: "not_applicable",
      policyVersion: null,
    });
  });

  it("fails closed to an unavailable section when bounded prefix integrity is broken", () => {
    const fixtures = successFixtures();
    const item = (fixtures.work.data?.items as Array<Record<string, unknown>>)[0];
    item.nextActions = {
      items: ["Implement provider"],
      total: 1,
      returned: 0,
      limit: 5,
      truncated: false,
    };

    const result = buildWorkspaceCoreControlCenterV2({
      ...fixtures,
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(result.status).toBe("degraded");
    expect(result.data.work.state).toBe("unavailable");
    expect(result.data.work.issueCodes).toEqual(["INTEGRITY_ERROR"]);
    expect(result.data.work.counts).toEqual({
      active: null,
      blocked: null,
      paused: null,
    });
    expect(result.data.work.workstreams.meta.completeness).toBe("unknown");
  });

  it("represents a provider read failure as unavailable instead of zero", () => {
    const fixtures = successFixtures();
    fixtures.operations = { data: null, unavailable: true };

    const result = buildWorkspaceCoreControlCenterV2({
      ...fixtures,
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(result.status).toBe("degraded");
    expect(result.data.operations.state).toBe("unavailable");
    expect(result.data.operations.issueCodes).toEqual(["SOURCE_UNAVAILABLE"]);
    expect(result.data.operations.counts.total).toBeNull();
    expect(result.data.operations.attention.meta).toEqual({
      completeness: "unknown",
      limit: 20,
      eligibleTotal: null,
      returned: 0,
    });
  });

  it("returns null age rather than zero for future watermarks", () => {
    const fixtures = successFixtures();
    if (fixtures.operations.data) {
      fixtures.operations.data.as_of_observed_at = "2026-10-06T01:00:00Z";
      fixtures.operations.data.as_of_delivered_at = "2026-10-06T01:00:00Z";
      fixtures.operations.data.source_coverage_items = [
        {
          sourceKey: "source-a",
          rowCount: 1,
          attentionCount: 0,
          lastObservedAt: "2026-10-06T01:00:00Z",
          lastDeliveredAt: "2026-10-06T01:00:00Z",
          observationVerdict: "unknown",
          deliveryVerdict: "unknown",
          deliveryBasis: "row_timestamp_proxy",
          observationPolicyVersion: null,
          deliveryPolicyVersion: null,
        },
      ];
    }

    const result = buildWorkspaceCoreControlCenterV2({
      ...fixtures,
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(result.data.operations.freshness.observation.ageHours).toBeNull();
    expect(result.data.operations.freshness.delivery.ageHours).toBeNull();
    expect(
      result.data.operations.sourceCoverage.items[0].observationAgeHours,
    ).toBeNull();
  });

  it("builds the exact non-success envelope with required nullable message", () => {
    expect(
      buildWorkspaceCoreControlCenterV2Error({
        status: "unconfigured",
        code: "PROVIDER_UNCONFIGURED",
        message: null,
        now: new Date("2026-10-06T00:00:00Z"),
      }),
    ).toEqual({
      status: "unconfigured",
      contract: "workspace-core.control-center-summary",
      version: "2.0",
      generatedAt: "2026-10-06T00:00:00.000Z",
      data: null,
      error: {
        code: "PROVIDER_UNCONFIGURED",
        message: null,
      },
    });
  });
});
