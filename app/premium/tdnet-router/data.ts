import type { SupabaseClient } from "@supabase/supabase-js";

export const TDNET_ATTENTION_STATUSES = [
  "classified",
  "review_required",
  "failed",
] as const;

export type TdnetAttentionStatus = (typeof TDNET_ATTENTION_STATUSES)[number];

export const TDNET_EVENT_TYPES = [
  "earnings_release",
  "performance_revision",
  "dividend_increase",
  "dividend_decrease",
  "dividend_change",
  "correction",
  "yutai_new",
  "yutai_expand",
  "yutai_change",
  "yutai_end",
  "yutai_review",
  "stock_split",
  "listing_regulatory",
  "share_buyback",
  "financing",
  "ma_reorganization",
  "midterm_plan",
] as const;

export type TdnetEventType = (typeof TDNET_EVENT_TYPES)[number];

export const TDNET_EVENT_LABELS: Record<TdnetEventType, string> = {
  earnings_release: "決算",
  performance_revision: "業績予想修正",
  dividend_increase: "増配・復配",
  dividend_decrease: "減配・無配",
  dividend_change: "配当変更",
  correction: "訂正",
  yutai_new: "優待新設",
  yutai_expand: "優待拡充",
  yutai_change: "優待変更",
  yutai_end: "優待廃止",
  yutai_review: "優待要確認",
  stock_split: "株式分割",
  listing_regulatory: "上場・規制",
  share_buyback: "自社株買い",
  financing: "資金調達",
  ma_reorganization: "M&A・再編",
  midterm_plan: "中期計画",
};

export const TDNET_STATUS_LABELS: Record<TdnetAttentionStatus, string> = {
  classified: "未処理",
  review_required: "要確認",
  failed: "失敗",
};

export const DEFAULT_REVIEW_LIMIT = 100;
export const MAX_REVIEW_LIMIT = 200;
export const REVIEW_LIMIT_OPTIONS = [25, 50, 100, 200] as const;

export type TdnetReviewEvent = {
  source_date: string;
  tdnet_disclosure_id: string;
  security_id: string;
  security_code: string;
  source_security_code: string;
  disclosed_at: string;
  title: string;
  event_type: TdnetEventType;
  policy_version: string;
  route_status: TdnetAttentionStatus;
  processed_at: string | null;
  ingested_at: string;
  pdf_url: string;
  company_listing_id: string | null;
  company_entity_id: string | null;
  company_name: string | null;
};

export type TdnetReviewFilters = {
  routeStatus?: TdnetAttentionStatus | null;
  eventType?: TdnetEventType | null;
  limit?: number;
};

export type TdnetReviewQueueData = {
  items: TdnetReviewEvent[];
  totalCount: number;
  routeStatus: TdnetAttentionStatus | null;
  eventType: TdnetEventType | null;
  limit: number;
};

function isOneOf<T extends string>(
  value: string,
  candidates: readonly T[],
): value is T {
  return candidates.includes(value as T);
}

export function parseTdnetAttentionStatus(
  value: string | undefined,
): TdnetAttentionStatus | null {
  if (!value || value === "all") return null;
  return isOneOf(value, TDNET_ATTENTION_STATUSES) ? value : null;
}

export function parseTdnetEventType(
  value: string | undefined,
): TdnetEventType | null {
  if (!value || value === "all") return null;
  return isOneOf(value, TDNET_EVENT_TYPES) ? value : null;
}

export function parseReviewLimit(value: string | undefined): number {
  if (!value) return DEFAULT_REVIEW_LIMIT;
  const parsed = Number(value);
  return REVIEW_LIMIT_OPTIONS.includes(
    parsed as (typeof REVIEW_LIMIT_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_REVIEW_LIMIT;
}

function validateLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_REVIEW_LIMIT) {
    throw new Error(`TDNET review limit must be between 1 and ${MAX_REVIEW_LIMIT}`);
  }
}

function validateStatus(status: TdnetAttentionStatus | null | undefined) {
  if (status && !TDNET_ATTENTION_STATUSES.includes(status)) {
    throw new Error(`unsupported TDNET route_status: ${status}`);
  }
}

function validateEventType(eventType: TdnetEventType | null | undefined) {
  if (eventType && !TDNET_EVENT_TYPES.includes(eventType)) {
    throw new Error(`unsupported TDNET event_type: ${eventType}`);
  }
}

export async function loadTdnetReviewQueue(
  supabase: SupabaseClient,
  userId: string,
  filters: TdnetReviewFilters = {},
): Promise<TdnetReviewQueueData> {
  const routeStatus = filters.routeStatus ?? null;
  const eventType = filters.eventType ?? null;
  const limit = filters.limit ?? DEFAULT_REVIEW_LIMIT;

  validateStatus(routeStatus);
  validateEventType(eventType);
  validateLimit(limit);

  let query = supabase
    .from("stock_notes_tdnet_hot_event_feed_v")
    .select(
      [
        "source_date",
        "tdnet_disclosure_id",
        "security_id",
        "security_code",
        "source_security_code",
        "disclosed_at",
        "title",
        "event_type",
        "policy_version",
        "route_status",
        "processed_at",
        "ingested_at",
        "pdf_url",
        "company_listing_id",
        "company_entity_id",
        "company_name",
      ].join(", "),
      { count: "exact" },
    )
    .eq("user_id", userId)
    .in(
      "route_status",
      routeStatus ? [routeStatus] : [...TDNET_ATTENTION_STATUSES],
    );

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error, count } = await query
    .order("disclosed_at", { ascending: false })
    .order("tdnet_disclosure_id", { ascending: false })
    .order("event_type", { ascending: true })
    .limit(limit)
    .returns<TdnetReviewEvent[]>();

  if (error) {
    throw error;
  }

  return {
    items: data ?? [],
    totalCount: count ?? (data ?? []).length,
    routeStatus,
    eventType,
    limit,
  };
}
