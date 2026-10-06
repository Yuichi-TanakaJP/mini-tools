export const WORKSPACE_CORE_CONTROL_CENTER_V2_CONTRACT =
  "workspace-core.control-center-summary" as const;
export const WORKSPACE_CORE_CONTROL_CENTER_V2_VERSION = "2.0" as const;

export type WorkspaceCoreControlCenterV2SectionState =
  | "available"
  | "degraded"
  | "unavailable";
export type WorkspaceCoreControlCenterV2FreshnessVerdict =
  | "current"
  | "stale"
  | "unknown"
  | "not_applicable";
export type WorkspaceCoreControlCenterV2DeliveryBasis =
  | "producer_ledger"
  | "row_timestamp_proxy"
  | "not_applicable";
export type WorkspaceCoreControlCenterV2IssueCode =
  | "SOURCE_UNAVAILABLE"
  | "DEPENDENCY_UNAVAILABLE"
  | "PARTIAL_RESULT"
  | "OBSERVATION_CLOCK_UNKNOWN"
  | "DELIVERY_CLOCK_UNKNOWN"
  | "TRANSITIONAL_DELIVERY_PROXY"
  | "INTEGRITY_ERROR";

export type WorkspaceCoreControlCenterV2CollectionMeta = {
  completeness: "complete" | "ranked_top_n" | "partial" | "unknown";
  limit: number | null;
  eligibleTotal: number | null;
  returned: number;
};

export type WorkspaceCoreControlCenterV2OrderedPrefix = {
  items: string[];
  total: number;
  returned: number;
  limit: 5;
  truncated: boolean;
};

type SectionCommon = {
  state: WorkspaceCoreControlCenterV2SectionState;
  asOf: {
    observedAt: string | null;
    deliveredAt: string | null;
  };
  freshness: {
    observation: {
      ageHours: number | null;
      verdict: WorkspaceCoreControlCenterV2FreshnessVerdict;
      policyVersion: string | null;
    };
    delivery: {
      ageHours: number | null;
      verdict: WorkspaceCoreControlCenterV2FreshnessVerdict;
      basis: WorkspaceCoreControlCenterV2DeliveryBasis;
      policyVersion: string | null;
    };
  };
  issueCodes: WorkspaceCoreControlCenterV2IssueCode[];
};

export type WorkspaceCoreControlCenterV2WorkItem = {
  code: string;
  title: string;
  status: "active" | "blocked" | "paused";
  phase: string | null;
  progressPct: number | null;
  summary: string | null;
  nextActions: WorkspaceCoreControlCenterV2OrderedPrefix;
  blockers: WorkspaceCoreControlCenterV2OrderedPrefix;
  updatedAt: string | null;
  lastUpdateAt: string | null;
  lastUpdateType: string | null;
  lastUpdateSummary: string | null;
};

export type WorkspaceCoreControlCenterV2AttentionItem = {
  sourceKey: string;
  subjectKey: string | null;
  metricKey: string;
  status: string;
  observedAt: string | null;
  deliveredAt: string | null;
  subjectLabel: string | null;
  metricLabel: string | null;
  productSlug: string | null;
  reasonCode: string | null;
  usageRatio: number | null;
  limitNeedsReview: boolean | null;
};

export type WorkspaceCoreControlCenterV2StatusEvent = {
  eventId: string;
  sourceKey: string;
  subjectKey: string | null;
  metricKey: string;
  previousStatus: string | null;
  newStatus: string;
  observedAt: string | null;
  deliveredAt: string | null;
  subjectLabel: string | null;
  metricLabel: string | null;
  productSlug: string | null;
  reasonCode: string | null;
  eventKind: string | null;
};

export type WorkspaceCoreControlCenterV2SourceCoverageItem = {
  sourceKey: string;
  rowCount: number;
  attentionCount: number;
  lastObservedAt: string | null;
  lastDeliveredAt: string | null;
  observationAgeHours: number | null;
  deliveryAgeHours: number | null;
  observationVerdict: WorkspaceCoreControlCenterV2FreshnessVerdict;
  deliveryVerdict: WorkspaceCoreControlCenterV2FreshnessVerdict;
  deliveryBasis: WorkspaceCoreControlCenterV2DeliveryBasis;
  observationPolicyVersion: string | null;
  deliveryPolicyVersion: string | null;
};

export type WorkspaceCoreControlCenterV2EvolutionItem = {
  eventId: string;
  eventType: string;
  title: string;
  summary: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  timePrecision: string | null;
  source: string | null;
  confidence: number | null;
  verifiedAt: string | null;
  updatedAt: string | null;
};

export type WorkspaceCoreControlCenterV2Data = {
  work: SectionCommon & {
    counts: {
      active: number | null;
      blocked: number | null;
      paused: number | null;
    };
    workstreams: {
      items: WorkspaceCoreControlCenterV2WorkItem[];
      meta: WorkspaceCoreControlCenterV2CollectionMeta;
    };
  };
  operations: SectionCommon & {
    counts: {
      ok: number | null;
      warning: number | null;
      critical: number | null;
      unknown: number | null;
      other: number | null;
      total: number | null;
    };
    attention: {
      items: WorkspaceCoreControlCenterV2AttentionItem[];
      meta: WorkspaceCoreControlCenterV2CollectionMeta;
    };
    recentEvents: {
      items: WorkspaceCoreControlCenterV2StatusEvent[];
      meta: WorkspaceCoreControlCenterV2CollectionMeta;
    };
    sourceCoverage: {
      items: WorkspaceCoreControlCenterV2SourceCoverageItem[];
      meta: WorkspaceCoreControlCenterV2CollectionMeta;
    };
  };
  evolution: SectionCommon & {
    events: {
      items: WorkspaceCoreControlCenterV2EvolutionItem[];
      meta: WorkspaceCoreControlCenterV2CollectionMeta;
    };
  };
  architecture: SectionCommon & {
    counts: {
      products: number | null;
      repositories: number | null;
      services: number | null;
    };
  };
};

export type WorkspaceCoreControlCenterV2Success = {
  status: "ok" | "degraded";
  contract: typeof WORKSPACE_CORE_CONTROL_CENTER_V2_CONTRACT;
  version: typeof WORKSPACE_CORE_CONTROL_CENTER_V2_VERSION;
  generatedAt: string;
  data: WorkspaceCoreControlCenterV2Data;
};

export type WorkspaceCoreControlCenterV2ErrorStatus =
  | "error"
  | "unauthenticated"
  | "forbidden"
  | "unconfigured";
export type WorkspaceCoreControlCenterV2ErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PROVIDER_UNCONFIGURED"
  | "PROVIDER_FAILURE";

export type WorkspaceCoreControlCenterV2Error = {
  status: WorkspaceCoreControlCenterV2ErrorStatus;
  contract: typeof WORKSPACE_CORE_CONTROL_CENTER_V2_CONTRACT;
  version: typeof WORKSPACE_CORE_CONTROL_CENTER_V2_VERSION;
  generatedAt: string;
  data: null;
  error: {
    code: WorkspaceCoreControlCenterV2ErrorCode;
    message: string | null;
  };
};

type Row = Record<string, unknown>;
export type WorkspaceCoreControlCenterV2SectionResult = {
  data: Row | null;
  unavailable: boolean;
};

class ContractIntegrityError extends Error {}

function record(value: unknown, label: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractIntegrityError(label);
  }
  return value as Row;
}

function stringValue(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value || value.length > max) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function nullableString(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > max) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function integerValue(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number)) throw new ContractIntegrityError(label);
  return number;
}

function nullableFiniteNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return finiteNumber(value, label);
}

function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") throw new ContractIntegrityError(label);
  return value;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function nullableDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractIntegrityError(label);
  return value;
}

function ageHours(now: Date, value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms > now.getTime()) return null;
  return (now.getTime() - ms) / 3_600_000;
}

function notApplicableFreshness(): SectionCommon["freshness"] {
  return {
    observation: {
      ageHours: null,
      verdict: "not_applicable",
      policyVersion: null,
    },
    delivery: {
      ageHours: null,
      verdict: "not_applicable",
      basis: "not_applicable",
      policyVersion: null,
    },
  };
}

function unavailableCommon(
  issueCode: WorkspaceCoreControlCenterV2IssueCode,
  freshnessApplies: boolean,
): SectionCommon {
  return {
    state: "unavailable",
    asOf: { observedAt: null, deliveredAt: null },
    freshness: freshnessApplies
      ? {
          observation: {
            ageHours: null,
            verdict: "unknown",
            policyVersion: null,
          },
          delivery: {
            ageHours: null,
            verdict: "unknown",
            basis: "not_applicable",
            policyVersion: null,
          },
        }
      : notApplicableFreshness(),
    issueCodes: [issueCode],
  };
}

function rankedMeta(
  limit: number,
  eligibleTotal: number,
  returned: number,
): WorkspaceCoreControlCenterV2CollectionMeta {
  if (returned !== Math.min(limit, eligibleTotal)) {
    throw new ContractIntegrityError("ranked collection size");
  }
  return {
    completeness: "ranked_top_n",
    limit,
    eligibleTotal,
    returned,
  };
}

function unknownMeta(limit: number): WorkspaceCoreControlCenterV2CollectionMeta {
  return {
    completeness: "unknown",
    limit,
    eligibleTotal: null,
    returned: 0,
  };
}

function orderedPrefix(
  value: unknown,
  label: string,
): WorkspaceCoreControlCenterV2OrderedPrefix {
  const row = record(value, label);
  const items = arrayValue(row.items, `${label}.items`).map((item, index) =>
    stringValue(item, `${label}.items[${index}]`, 2000),
  );
  const total = integerValue(row.total, `${label}.total`);
  const returned = integerValue(row.returned, `${label}.returned`);
  if (row.limit !== 5) throw new ContractIntegrityError(`${label}.limit`);
  if (typeof row.truncated !== "boolean") {
    throw new ContractIntegrityError(`${label}.truncated`);
  }
  if (
    returned !== items.length ||
    returned !== Math.min(total, 5) ||
    row.truncated !== (total > returned)
  ) {
    throw new ContractIntegrityError(label);
  }
  return {
    items,
    total,
    returned,
    limit: 5,
    truncated: row.truncated,
  };
}

function workItem(value: unknown): WorkspaceCoreControlCenterV2WorkItem {
  const row = record(value, "work item");
  const status = stringValue(row.status, "work.status", 128);
  if (status !== "active" && status !== "blocked" && status !== "paused") {
    throw new ContractIntegrityError("work.status");
  }
  return {
    code: stringValue(row.code, "work.code", 128),
    title: stringValue(row.title, "work.title", 256),
    status,
    phase: nullableString(row.phase, "work.phase", 256),
    progressPct: nullableFiniteNumber(row.progressPct, "work.progressPct"),
    summary: nullableString(row.summary, "work.summary", 2000),
    nextActions: orderedPrefix(row.nextActions, "work.nextActions"),
    blockers: orderedPrefix(row.blockers, "work.blockers"),
    updatedAt: nullableTimestamp(row.updatedAt, "work.updatedAt"),
    lastUpdateAt: nullableTimestamp(row.lastUpdateAt, "work.lastUpdateAt"),
    lastUpdateType: nullableString(
      row.lastUpdateType,
      "work.lastUpdateType",
      128,
    ),
    lastUpdateSummary: nullableString(
      row.lastUpdateSummary,
      "work.lastUpdateSummary",
      2000,
    ),
  };
}

function buildWorkSection(
  result: WorkspaceCoreControlCenterV2SectionResult,
): WorkspaceCoreControlCenterV2Data["work"] {
  if (result.unavailable || !result.data) {
    return {
      ...unavailableCommon("SOURCE_UNAVAILABLE", false),
      counts: { active: null, blocked: null, paused: null },
      workstreams: { items: [], meta: unknownMeta(12) },
    };
  }

  try {
    const active = integerValue(result.data.active_count, "work.active_count");
    const blocked = integerValue(
      result.data.blocked_count,
      "work.blocked_count",
    );
    const paused = integerValue(result.data.paused_count, "work.paused_count");
    const eligibleTotal = integerValue(
      result.data.eligible_total,
      "work.eligible_total",
    );
    if (active + blocked + paused !== eligibleTotal) {
      throw new ContractIntegrityError("work counts");
    }
    const items = arrayValue(result.data.items, "work.items").map(workItem);
    if (items.length > 12) throw new ContractIntegrityError("work.items");
    const meta = rankedMeta(12, eligibleTotal, items.length);
    return {
      state: "available",
      asOf: { observedAt: null, deliveredAt: null },
      freshness: notApplicableFreshness(),
      issueCodes: [],
      counts: { active, blocked, paused },
      workstreams: { items, meta },
    };
  } catch {
    return {
      ...unavailableCommon("INTEGRITY_ERROR", false),
      counts: { active: null, blocked: null, paused: null },
      workstreams: { items: [], meta: unknownMeta(12) },
    };
  }
}

function attentionItem(
  value: unknown,
): WorkspaceCoreControlCenterV2AttentionItem {
  const row = record(value, "attention item");
  return {
    sourceKey: stringValue(row.sourceKey, "attention.sourceKey", 128),
    subjectKey: nullableString(row.subjectKey, "attention.subjectKey", 128),
    metricKey: stringValue(row.metricKey, "attention.metricKey", 128),
    status: stringValue(row.status, "attention.status", 128),
    observedAt: nullableTimestamp(row.observedAt, "attention.observedAt"),
    deliveredAt: nullableTimestamp(row.deliveredAt, "attention.deliveredAt"),
    subjectLabel: nullableString(
      row.subjectLabel,
      "attention.subjectLabel",
      256,
    ),
    metricLabel: nullableString(row.metricLabel, "attention.metricLabel", 256),
    productSlug: nullableString(row.productSlug, "attention.productSlug", 128),
    reasonCode: nullableString(row.reasonCode, "attention.reasonCode", 2000),
    usageRatio: nullableFiniteNumber(row.usageRatio, "attention.usageRatio"),
    limitNeedsReview: nullableBoolean(
      row.limitNeedsReview,
      "attention.limitNeedsReview",
    ),
  };
}

function statusEvent(
  value: unknown,
): WorkspaceCoreControlCenterV2StatusEvent {
  const row = record(value, "status event");
  return {
    eventId: stringValue(row.eventId, "event.eventId", 128),
    sourceKey: stringValue(row.sourceKey, "event.sourceKey", 128),
    subjectKey: nullableString(row.subjectKey, "event.subjectKey", 128),
    metricKey: stringValue(row.metricKey, "event.metricKey", 128),
    previousStatus: nullableString(
      row.previousStatus,
      "event.previousStatus",
      128,
    ),
    newStatus: stringValue(row.newStatus, "event.newStatus", 128),
    observedAt: nullableTimestamp(row.observedAt, "event.observedAt"),
    deliveredAt: nullableTimestamp(row.deliveredAt, "event.deliveredAt"),
    subjectLabel: nullableString(row.subjectLabel, "event.subjectLabel", 256),
    metricLabel: nullableString(row.metricLabel, "event.metricLabel", 256),
    productSlug: nullableString(row.productSlug, "event.productSlug", 128),
    reasonCode: nullableString(row.reasonCode, "event.reasonCode", 2000),
    eventKind: nullableString(row.eventKind, "event.eventKind", 128),
  };
}

function deliveryBasis(
  value: unknown,
  label: string,
): WorkspaceCoreControlCenterV2DeliveryBasis {
  if (
    value !== "row_timestamp_proxy" &&
    value !== "producer_ledger" &&
    value !== "not_applicable"
  ) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function freshnessVerdict(
  value: unknown,
  label: string,
): WorkspaceCoreControlCenterV2FreshnessVerdict {
  if (
    value !== "current" &&
    value !== "stale" &&
    value !== "unknown" &&
    value !== "not_applicable"
  ) {
    throw new ContractIntegrityError(label);
  }
  return value;
}

function sourceCoverageItem(
  value: unknown,
  now: Date,
): WorkspaceCoreControlCenterV2SourceCoverageItem {
  const row = record(value, "source coverage item");
  const lastObservedAt = nullableTimestamp(
    row.lastObservedAt,
    "source.lastObservedAt",
  );
  const lastDeliveredAt = nullableTimestamp(
    row.lastDeliveredAt,
    "source.lastDeliveredAt",
  );
  const rowCount = integerValue(row.rowCount, "source.rowCount");
  const attentionCount = integerValue(
    row.attentionCount,
    "source.attentionCount",
  );
  if (attentionCount > rowCount) {
    throw new ContractIntegrityError("source.attentionCount");
  }
  return {
    sourceKey: stringValue(row.sourceKey, "source.sourceKey", 128),
    rowCount,
    attentionCount,
    lastObservedAt,
    lastDeliveredAt,
    observationAgeHours: ageHours(now, lastObservedAt),
    deliveryAgeHours: ageHours(now, lastDeliveredAt),
    observationVerdict: freshnessVerdict(
      row.observationVerdict,
      "source.observationVerdict",
    ),
    deliveryVerdict: freshnessVerdict(
      row.deliveryVerdict,
      "source.deliveryVerdict",
    ),
    deliveryBasis: deliveryBasis(row.deliveryBasis, "source.deliveryBasis"),
    observationPolicyVersion: nullableString(
      row.observationPolicyVersion,
      "source.observationPolicyVersion",
      128,
    ),
    deliveryPolicyVersion: nullableString(
      row.deliveryPolicyVersion,
      "source.deliveryPolicyVersion",
      128,
    ),
  };
}

function buildOperationsSection(
  result: WorkspaceCoreControlCenterV2SectionResult,
  now: Date,
): WorkspaceCoreControlCenterV2Data["operations"] {
  const unavailable = (
    issueCode: WorkspaceCoreControlCenterV2IssueCode,
  ): WorkspaceCoreControlCenterV2Data["operations"] => ({
    ...unavailableCommon(issueCode, true),
    counts: {
      ok: null,
      warning: null,
      critical: null,
      unknown: null,
      other: null,
      total: null,
    },
    attention: { items: [], meta: unknownMeta(20) },
    recentEvents: { items: [], meta: unknownMeta(12) },
    sourceCoverage: { items: [], meta: unknownMeta(64) },
  });

  if (result.unavailable || !result.data) return unavailable("SOURCE_UNAVAILABLE");

  try {
    const ok = integerValue(result.data.ok_count, "operations.ok_count");
    const warning = integerValue(
      result.data.warning_count,
      "operations.warning_count",
    );
    const critical = integerValue(
      result.data.critical_count,
      "operations.critical_count",
    );
    const unknown = integerValue(
      result.data.unknown_count,
      "operations.unknown_count",
    );
    const other = integerValue(
      result.data.other_count,
      "operations.other_count",
    );
    const total = integerValue(
      result.data.total_count,
      "operations.total_count",
    );
    if (ok + warning + critical + unknown + other !== total) {
      throw new ContractIntegrityError("operations counts");
    }

    const attentionEligible = integerValue(
      result.data.attention_eligible_total,
      "operations.attention_eligible_total",
    );
    const attention = arrayValue(
      result.data.attention_items,
      "operations.attention_items",
    ).map(attentionItem);
    if (attention.length > 20) {
      throw new ContractIntegrityError("operations.attention_items");
    }

    const eventEligible = integerValue(
      result.data.event_eligible_total,
      "operations.event_eligible_total",
    );
    const recentEvents = arrayValue(
      result.data.recent_event_items,
      "operations.recent_event_items",
    ).map(statusEvent);
    if (recentEvents.length > 12) {
      throw new ContractIntegrityError("operations.recent_event_items");
    }

    const sourceEligible = integerValue(
      result.data.source_eligible_total,
      "operations.source_eligible_total",
    );
    const sourceCoverage = arrayValue(
      result.data.source_coverage_items,
      "operations.source_coverage_items",
    ).map((item) => sourceCoverageItem(item, now));
    if (sourceCoverage.length > 64) {
      throw new ContractIntegrityError("operations.source_coverage_items");
    }

    const attentionMeta = rankedMeta(
      20,
      attentionEligible,
      attention.length,
    );
    const eventsMeta = rankedMeta(12, eventEligible, recentEvents.length);
    const sourceMeta = rankedMeta(
      64,
      sourceEligible,
      sourceCoverage.length,
    );

    const observedAt = nullableTimestamp(
      result.data.as_of_observed_at,
      "operations.as_of_observed_at",
    );
    const deliveredAt = nullableTimestamp(
      result.data.as_of_delivered_at,
      "operations.as_of_delivered_at",
    );
    const basis = deliveryBasis(
      result.data.delivery_basis,
      "operations.delivery_basis",
    );

    if (sourceEligible === 0) {
      if (observedAt !== null || deliveredAt !== null || basis !== "not_applicable") {
        throw new ContractIntegrityError("operations empty source clocks");
      }
      if (total !== 0 || attentionEligible !== 0) {
        throw new ContractIntegrityError("operations empty source counts");
      }
      return {
        state: "available",
        asOf: { observedAt: null, deliveredAt: null },
        freshness: notApplicableFreshness(),
        issueCodes: [],
        counts: { ok, warning, critical, unknown, other, total },
        attention: { items: attention, meta: attentionMeta },
        recentEvents: { items: recentEvents, meta: eventsMeta },
        sourceCoverage: { items: sourceCoverage, meta: sourceMeta },
      };
    }

    const issueCodes: WorkspaceCoreControlCenterV2IssueCode[] = [];
    if (!observedAt) issueCodes.push("OBSERVATION_CLOCK_UNKNOWN");
    if (!deliveredAt) issueCodes.push("DELIVERY_CLOCK_UNKNOWN");
    if (basis === "row_timestamp_proxy") {
      issueCodes.push("TRANSITIONAL_DELIVERY_PROXY");
    }
    const degraded = issueCodes.some(
      (code) =>
        code === "OBSERVATION_CLOCK_UNKNOWN" ||
        code === "DELIVERY_CLOCK_UNKNOWN",
    );

    return {
      state: degraded ? "degraded" : "available",
      asOf: { observedAt, deliveredAt },
      freshness: {
        observation: {
          ageHours: ageHours(now, observedAt),
          verdict: "unknown",
          policyVersion: null,
        },
        delivery: {
          ageHours: ageHours(now, deliveredAt),
          verdict: "unknown",
          basis,
          policyVersion: null,
        },
      },
      issueCodes,
      counts: { ok, warning, critical, unknown, other, total },
      attention: { items: attention, meta: attentionMeta },
      recentEvents: { items: recentEvents, meta: eventsMeta },
      sourceCoverage: { items: sourceCoverage, meta: sourceMeta },
    };
  } catch {
    return unavailable("INTEGRITY_ERROR");
  }
}

function evolutionItem(
  value: unknown,
): WorkspaceCoreControlCenterV2EvolutionItem {
  const row = record(value, "evolution item");
  return {
    eventId: stringValue(row.eventId, "evolution.eventId", 128),
    eventType: stringValue(row.eventType, "evolution.eventType", 128),
    title: stringValue(row.title, "evolution.title", 256),
    summary: nullableString(row.summary, "evolution.summary", 2000),
    periodStart: nullableDate(row.periodStart, "evolution.periodStart"),
    periodEnd: nullableDate(row.periodEnd, "evolution.periodEnd"),
    timePrecision: nullableString(
      row.timePrecision,
      "evolution.timePrecision",
      128,
    ),
    source: nullableString(row.source, "evolution.source", 2048),
    confidence: nullableFiniteNumber(
      row.confidence,
      "evolution.confidence",
    ),
    verifiedAt: nullableTimestamp(row.verifiedAt, "evolution.verifiedAt"),
    updatedAt: nullableTimestamp(row.updatedAt, "evolution.updatedAt"),
  };
}

function buildEvolutionSection(
  result: WorkspaceCoreControlCenterV2SectionResult,
): WorkspaceCoreControlCenterV2Data["evolution"] {
  if (result.unavailable || !result.data) {
    return {
      ...unavailableCommon("SOURCE_UNAVAILABLE", false),
      events: { items: [], meta: unknownMeta(8) },
    };
  }
  try {
    const eligibleTotal = integerValue(
      result.data.eligible_total,
      "evolution.eligible_total",
    );
    const items = arrayValue(result.data.items, "evolution.items").map(
      evolutionItem,
    );
    if (items.length > 8) throw new ContractIntegrityError("evolution.items");
    return {
      state: "available",
      asOf: { observedAt: null, deliveredAt: null },
      freshness: notApplicableFreshness(),
      issueCodes: [],
      events: {
        items,
        meta: rankedMeta(8, eligibleTotal, items.length),
      },
    };
  } catch {
    return {
      ...unavailableCommon("INTEGRITY_ERROR", false),
      events: { items: [], meta: unknownMeta(8) },
    };
  }
}

function buildArchitectureSection(
  result: WorkspaceCoreControlCenterV2SectionResult,
): WorkspaceCoreControlCenterV2Data["architecture"] {
  if (result.unavailable || !result.data) {
    return {
      ...unavailableCommon("SOURCE_UNAVAILABLE", false),
      counts: { products: null, repositories: null, services: null },
    };
  }
  try {
    return {
      state: "available",
      asOf: { observedAt: null, deliveredAt: null },
      freshness: notApplicableFreshness(),
      issueCodes: [],
      counts: {
        products: integerValue(
          result.data.products,
          "architecture.products",
        ),
        repositories: integerValue(
          result.data.repositories,
          "architecture.repositories",
        ),
        services: integerValue(
          result.data.services,
          "architecture.services",
        ),
      },
    };
  } catch {
    return {
      ...unavailableCommon("INTEGRITY_ERROR", false),
      counts: { products: null, repositories: null, services: null },
    };
  }
}

export function buildWorkspaceCoreControlCenterV2(input: {
  work: WorkspaceCoreControlCenterV2SectionResult;
  operations: WorkspaceCoreControlCenterV2SectionResult;
  evolution: WorkspaceCoreControlCenterV2SectionResult;
  architecture: WorkspaceCoreControlCenterV2SectionResult;
  now?: Date;
}): WorkspaceCoreControlCenterV2Success {
  const now = input.now ?? new Date();
  const data: WorkspaceCoreControlCenterV2Data = {
    work: buildWorkSection(input.work),
    operations: buildOperationsSection(input.operations, now),
    evolution: buildEvolutionSection(input.evolution),
    architecture: buildArchitectureSection(input.architecture),
  };
  const degraded = Object.values(data).some(
    (section) => section.state !== "available",
  );
  return {
    status: degraded ? "degraded" : "ok",
    contract: WORKSPACE_CORE_CONTROL_CENTER_V2_CONTRACT,
    version: WORKSPACE_CORE_CONTROL_CENTER_V2_VERSION,
    generatedAt: now.toISOString(),
    data,
  };
}

export function buildWorkspaceCoreControlCenterV2Error(input: {
  status: WorkspaceCoreControlCenterV2ErrorStatus;
  code: WorkspaceCoreControlCenterV2ErrorCode;
  message?: string | null;
  now?: Date;
}): WorkspaceCoreControlCenterV2Error {
  const message =
    input.message === null || input.message === undefined
      ? null
      : input.message.slice(0, 2000);
  return {
    status: input.status,
    contract: WORKSPACE_CORE_CONTROL_CENTER_V2_CONTRACT,
    version: WORKSPACE_CORE_CONTROL_CENTER_V2_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    data: null,
    error: { code: input.code, message },
  };
}
