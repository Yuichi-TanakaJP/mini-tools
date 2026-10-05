export type WorkspaceCoreControlCenterWorkstream = {
  code: string;
  title: string;
  status: string;
  phase: string | null;
  progressPct: number | null;
  summary: string | null;
  nextActions: string[];
  blockers: string[];
  updatedAt: string | null;
  lastUpdateAt: string | null;
  lastUpdateType: string | null;
  lastUpdateSummary: string | null;
};

export type WorkspaceCoreControlCenterCurrentState = {
  sourceKey: string;
  subjectKey: string | null;
  metricKey: string;
  status: string;
  observedAt: string | null;
  subjectLabel: string | null;
  metricLabel: string | null;
  productSlug: string | null;
  reasonCode: string | null;
  usageRatio: number | null;
  limitNeedsReview: boolean | null;
};

export type WorkspaceCoreControlCenterStatusEvent = {
  eventId: string;
  sourceKey: string;
  subjectKey: string | null;
  metricKey: string;
  previousStatus: string | null;
  newStatus: string;
  observedAt: string | null;
  subjectLabel: string | null;
  metricLabel: string | null;
  productSlug: string | null;
  reasonCode: string | null;
  eventKind: string | null;
};

export type WorkspaceCoreControlCenter = {
  generatedAt: string;
  work: {
    activeCount: number;
    blockedCount: number;
    pausedCount: number;
    items: WorkspaceCoreControlCenterWorkstream[];
  };
  operations: {
    counts: {
      ok: number;
      warning: number;
      critical: number;
      unknown: number;
      other: number;
    };
    total: number;
    lastObservedAt: string | null;
    stale: boolean;
    staleHours: number | null;
    attention: WorkspaceCoreControlCenterCurrentState[];
    recentEvents: WorkspaceCoreControlCenterStatusEvent[];
  };
  architecture: {
    products: number;
    repositories: number;
    services: number;
  };
};

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? (row[key] as string) : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = text(row, key).trim();
  return value ? value : null;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function nullableBoolean(row: Row, key: string): boolean | null {
  return typeof row[key] === "boolean" ? (row[key] as boolean) : null;
}

function stringArray(row: Row, key: string): string[] {
  const value = row[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusRank(status: string): number {
  if (status === "critical") return 0;
  if (status === "warning") return 1;
  if (status === "unknown") return 2;
  if (status === "ok") return 4;
  return 3;
}

function workstreamRank(status: string): number {
  if (status === "blocked") return 0;
  if (status === "active") return 1;
  if (status === "paused") return 2;
  return 3;
}

function workstream(row: Row): WorkspaceCoreControlCenterWorkstream {
  return {
    code: text(row, "workstream_code"),
    title: text(row, "workstream_title"),
    status: text(row, "status"),
    phase: nullableText(row, "current_phase"),
    progressPct: nullableNumber(row, "progress_pct"),
    summary: nullableText(row, "current_summary"),
    nextActions: stringArray(row, "next_actions"),
    blockers: stringArray(row, "blockers"),
    updatedAt: nullableText(row, "workstream_updated_at"),
    lastUpdateAt: nullableText(row, "last_update_at"),
    lastUpdateType: nullableText(row, "last_update_type"),
    lastUpdateSummary: nullableText(row, "last_update_summary"),
  };
}

function currentState(row: Row): WorkspaceCoreControlCenterCurrentState {
  return {
    sourceKey: text(row, "source_key"),
    subjectKey: nullableText(row, "subject_key"),
    metricKey: text(row, "metric_key"),
    status: text(row, "status"),
    observedAt: nullableText(row, "observed_at"),
    subjectLabel: nullableText(row, "subject_label"),
    metricLabel: nullableText(row, "metric_label"),
    productSlug: nullableText(row, "product_slug"),
    reasonCode: nullableText(row, "reason_code"),
    usageRatio: nullableNumber(row, "usage_ratio"),
    limitNeedsReview: nullableBoolean(row, "limit_needs_review"),
  };
}

function statusEvent(row: Row): WorkspaceCoreControlCenterStatusEvent {
  return {
    eventId: text(row, "event_id"),
    sourceKey: text(row, "source_key"),
    subjectKey: nullableText(row, "subject_key"),
    metricKey: text(row, "metric_key"),
    previousStatus: nullableText(row, "previous_status"),
    newStatus: text(row, "new_status"),
    observedAt: nullableText(row, "observed_at"),
    subjectLabel: nullableText(row, "subject_label"),
    metricLabel: nullableText(row, "metric_label"),
    productSlug: nullableText(row, "product_slug"),
    reasonCode: nullableText(row, "reason_code"),
    eventKind: nullableText(row, "event_kind"),
  };
}

export function uniqueNonEmptyCount(rows: Row[], key: string): number {
  return new Set(rows.map((row) => text(row, key).trim()).filter(Boolean)).size;
}

export function buildWorkspaceCoreControlCenter(input: {
  workstreamRows: Row[];
  currentRows: Row[];
  eventRows: Row[];
  architecture: { products: number; repositories: number; services: number };
  now?: Date;
}): WorkspaceCoreControlCenter {
  const now = input.now ?? new Date();

  const workItems = input.workstreamRows
    .map(workstream)
    .filter((item) => item.code && item.title && ["active", "blocked", "paused"].includes(item.status))
    .sort((a, b) => {
      const statusDiff = workstreamRank(a.status) - workstreamRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      const blockerDiff = b.blockers.length - a.blockers.length;
      if (blockerDiff !== 0) return blockerDiff;
      return (timestampMs(b.lastUpdateAt ?? b.updatedAt) ?? 0) - (timestampMs(a.lastUpdateAt ?? a.updatedAt) ?? 0);
    })
    .slice(0, 12);

  const current = input.currentRows.map(currentState);
  const counts = { ok: 0, warning: 0, critical: 0, unknown: 0, other: 0 };
  for (const item of current) {
    if (item.status === "ok") counts.ok += 1;
    else if (item.status === "warning") counts.warning += 1;
    else if (item.status === "critical") counts.critical += 1;
    else if (item.status === "unknown") counts.unknown += 1;
    else counts.other += 1;
  }

  const lastObservedMs = current
    .map((item) => timestampMs(item.observedAt))
    .filter((value): value is number => value !== null)
    .reduce<number | null>((latest, value) => (latest === null || value > latest ? value : latest), null);

  const staleHours =
    lastObservedMs === null ? null : Math.max(0, (now.getTime() - lastObservedMs) / (60 * 60 * 1000));
  const stale = staleHours === null || staleHours > 24;

  const attention = current
    .filter((item) => item.status !== "ok")
    .sort((a, b) => {
      const statusDiff = statusRank(a.status) - statusRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      return (timestampMs(b.observedAt) ?? 0) - (timestampMs(a.observedAt) ?? 0);
    })
    .slice(0, 20);

  const recentEvents = input.eventRows
    .map(statusEvent)
    .filter((item) => item.eventId && item.sourceKey && item.metricKey && item.newStatus)
    .sort((a, b) => (timestampMs(b.observedAt) ?? 0) - (timestampMs(a.observedAt) ?? 0))
    .slice(0, 12);

  return {
    generatedAt: now.toISOString(),
    work: {
      activeCount: workItems.filter((item) => item.status === "active").length,
      blockedCount: workItems.filter((item) => item.status === "blocked").length,
      pausedCount: workItems.filter((item) => item.status === "paused").length,
      items: workItems,
    },
    operations: {
      counts,
      total: current.length,
      lastObservedAt: lastObservedMs === null ? null : new Date(lastObservedMs).toISOString(),
      stale,
      staleHours,
      attention,
      recentEvents,
    },
    architecture: input.architecture,
  };
}
