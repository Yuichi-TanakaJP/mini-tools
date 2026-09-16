export type YutaiScheduledGrantStatus = "scheduled" | "materialized" | "cancelled";

export type YutaiScheduledGrantItem = {
  id: string;
  account_id: string;
  account_key: string;
  account_title: string;
  benefit_kind: string;
  native_unit: string;
  title: string;
  company: string;
  scheduled_on: string;
  expected_native_value: number;
  expected_expires_on: string | null;
  expected_yen: number | null;
  status: YutaiScheduledGrantStatus;
  materialized_reward_id: string | null;
  materialized_at: string | null;
  note: string;
  last_error: string | null;
};

export type YutaiScheduledGrants = {
  schema_version: 1;
  as_of: string;
  from: string;
  to: string;
  items: YutaiScheduledGrantItem[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function str(value: unknown, field: string) { if (typeof value !== "string") throw new Error(`INVALID_YUTAI_SCHEDULE:${field}`); return value; }
function optStr(value: unknown, field: string) { if (value === null) return null; return str(value, field); }
function num(value: unknown, field: string) { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_YUTAI_SCHEDULE:${field}`); return value; }
function optNum(value: unknown, field: string) { if (value === null) return null; return num(value, field); }
function status(value: unknown): YutaiScheduledGrantStatus {
  const v = str(value, "status");
  if (!["scheduled", "materialized", "cancelled"].includes(v)) throw new Error("INVALID_YUTAI_SCHEDULE:status");
  return v as YutaiScheduledGrantStatus;
}

function parseItem(value: unknown): YutaiScheduledGrantItem {
  if (!isObject(value)) throw new Error("INVALID_YUTAI_SCHEDULE:item");
  return {
    id: str(value.id,"id"), account_id: str(value.account_id,"account_id"), account_key: str(value.account_key,"account_key"), account_title: str(value.account_title,"account_title"),
    benefit_kind: str(value.benefit_kind,"benefit_kind"), native_unit: str(value.native_unit,"native_unit"), title: str(value.title,"title"), company: str(value.company,"company"),
    scheduled_on: str(value.scheduled_on,"scheduled_on"), expected_native_value: num(value.expected_native_value,"expected_native_value"), expected_expires_on: optStr(value.expected_expires_on,"expected_expires_on"), expected_yen: optNum(value.expected_yen,"expected_yen"),
    status: status(value.status), materialized_reward_id: optStr(value.materialized_reward_id,"materialized_reward_id"), materialized_at: optStr(value.materialized_at,"materialized_at"),
    note: str(value.note,"note"), last_error: optStr(value.last_error,"last_error"),
  };
}

export function parseYutaiScheduledGrants(value: unknown): YutaiScheduledGrants {
  if (!isObject(value) || value.schema_version !== 1 || !Array.isArray(value.items)) throw new Error("INVALID_YUTAI_SCHEDULE:root");
  return { schema_version:1, as_of:str(value.as_of,"as_of"), from:str(value.from,"from"), to:str(value.to,"to"), items:value.items.map(parseItem) };
}
