export type YutaiValueCoverage = "complete" | "partial";

export type YutaiValuePerformanceSummary = {
  acquired_yen: number;
  used_yen: number;
  expired_yen: number;
  current_yen: number;
  waived_yen: number;
  uncertain_yen: number;
  unclassified_increase_yen: number;
  unclassified_decrease_yen: number;
  expired_unprocessed_yen: number;
  unvalued_reward_count: number;
  unvalued_entitlement_count: number;
  partial_item_count: number;
  coverage: YutaiValueCoverage;
};

export type YutaiValuePerformanceItem = {
  source_type: "reward" | "entitlement";
  id: string;
  title: string;
  company: string;
  acquired_yen: number | null;
  used_yen: number | null;
  expired_yen: number | null;
  current_yen: number | null;
  waived_yen: number | null;
  uncertain_yen: number | null;
  unclassified_increase_yen: number | null;
  unclassified_decrease_yen: number | null;
  expired_unprocessed_yen: number | null;
  quality: string;
};

export type YutaiValuePerformance = {
  schema_version: 1;
  as_of: string;
  today: string;
  summary: YutaiValuePerformanceSummary;
  items: YutaiValuePerformanceItem[];
};

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`INVALID_VALUE_PERFORMANCE:${field}`);
  return value as Record<string, unknown>;
}
function string(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`INVALID_VALUE_PERFORMANCE:${field}`);
  return value;
}
function number(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_VALUE_PERFORMANCE:${field}`);
  return value;
}
function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return number(value, field);
}

function parseItem(value: unknown): YutaiValuePerformanceItem {
  const v = object(value, "item");
  const source = string(v.source_type, "item.source_type");
  if (source !== "reward" && source !== "entitlement") throw new Error("INVALID_VALUE_PERFORMANCE:item.source_type");
  return {
    source_type: source,
    id: string(v.id, "item.id"),
    title: string(v.title, "item.title"),
    company: string(v.company, "item.company"),
    acquired_yen: nullableNumber(v.acquired_yen, "item.acquired_yen"),
    used_yen: nullableNumber(v.used_yen, "item.used_yen"),
    expired_yen: nullableNumber(v.expired_yen, "item.expired_yen"),
    current_yen: nullableNumber(v.current_yen, "item.current_yen"),
    waived_yen: nullableNumber(v.waived_yen, "item.waived_yen"),
    uncertain_yen: nullableNumber(v.uncertain_yen, "item.uncertain_yen"),
    unclassified_increase_yen: nullableNumber(v.unclassified_increase_yen, "item.unclassified_increase_yen"),
    unclassified_decrease_yen: nullableNumber(v.unclassified_decrease_yen, "item.unclassified_decrease_yen"),
    expired_unprocessed_yen: nullableNumber(v.expired_unprocessed_yen, "item.expired_unprocessed_yen"),
    quality: string(v.quality, "item.quality"),
  };
}

export function parseYutaiValuePerformance(value: unknown): YutaiValuePerformance {
  const root = object(value, "root");
  if (root.schema_version !== 1) throw new Error("INVALID_VALUE_PERFORMANCE:schema_version");
  const summary = object(root.summary, "summary");
  const coverage = string(summary.coverage, "summary.coverage");
  if (coverage !== "complete" && coverage !== "partial") throw new Error("INVALID_VALUE_PERFORMANCE:summary.coverage");
  if (!Array.isArray(root.items)) throw new Error("INVALID_VALUE_PERFORMANCE:items");
  return {
    schema_version: 1,
    as_of: string(root.as_of, "as_of"),
    today: string(root.today, "today"),
    summary: {
      acquired_yen: number(summary.acquired_yen, "summary.acquired_yen"),
      used_yen: number(summary.used_yen, "summary.used_yen"),
      expired_yen: number(summary.expired_yen, "summary.expired_yen"),
      current_yen: number(summary.current_yen, "summary.current_yen"),
      waived_yen: number(summary.waived_yen, "summary.waived_yen"),
      uncertain_yen: number(summary.uncertain_yen, "summary.uncertain_yen"),
      unclassified_increase_yen: number(summary.unclassified_increase_yen, "summary.unclassified_increase_yen"),
      unclassified_decrease_yen: number(summary.unclassified_decrease_yen, "summary.unclassified_decrease_yen"),
      expired_unprocessed_yen: number(summary.expired_unprocessed_yen, "summary.expired_unprocessed_yen"),
      unvalued_reward_count: number(summary.unvalued_reward_count, "summary.unvalued_reward_count"),
      unvalued_entitlement_count: number(summary.unvalued_entitlement_count, "summary.unvalued_entitlement_count"),
      partial_item_count: number(summary.partial_item_count, "summary.partial_item_count"),
      coverage,
    },
    items: root.items.map(parseItem),
  };
}
