export type YutaiBenefitSummaryItem = {
  group_key: string;
  title: string;
  company: string;
  benefit_kind: string;
  native_unit: string | null;
  acquired_native: number;
  used_native: number;
  expired_native: number;
  current_native: number;
  scheduled_native: number;
  acquired_yen: number;
  used_yen: number;
  expired_yen: number;
  current_yen: number;
  scheduled_yen: number;
  waived_yen: number;
  uncertain_yen: number;
  has_unvalued: boolean;
  history_partial: boolean;
  account_keys: string[];
  reward_ids: string[];
  entitlement_ids: string[];
  source_count: number;
  next_scheduled_on: string | null;
  next_expected_expires_on: string | null;
};

export type YutaiBenefitSummary = {
  schema_version: 1;
  as_of: string;
  today: string;
  count: number;
  items: YutaiBenefitSummaryItem[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function str(value: unknown, field: string) { if (typeof value !== "string") throw new Error(`INVALID_YUTAI_BENEFIT_SUMMARY:${field}`); return value; }
function optStr(value: unknown, field: string) { if (value === null) return null; return str(value, field); }
function num(value: unknown, field: string) { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_YUTAI_BENEFIT_SUMMARY:${field}`); return value; }
function bool(value: unknown, field: string) { if (typeof value !== "boolean") throw new Error(`INVALID_YUTAI_BENEFIT_SUMMARY:${field}`); return value; }
function strArray(value: unknown, field: string) { if (!Array.isArray(value) || !value.every(v => typeof v === "string")) throw new Error(`INVALID_YUTAI_BENEFIT_SUMMARY:${field}`); return value as string[]; }

function parseItem(value: unknown): YutaiBenefitSummaryItem {
  if (!isObject(value)) throw new Error("INVALID_YUTAI_BENEFIT_SUMMARY:item");
  return {
    group_key: str(value.group_key,"group_key"), title: str(value.title,"title"), company: str(value.company,"company"), benefit_kind: str(value.benefit_kind,"benefit_kind"), native_unit: optStr(value.native_unit,"native_unit"),
    acquired_native: num(value.acquired_native,"acquired_native"), used_native: num(value.used_native,"used_native"), expired_native: num(value.expired_native,"expired_native"), current_native: num(value.current_native,"current_native"), scheduled_native: num(value.scheduled_native,"scheduled_native"),
    acquired_yen: num(value.acquired_yen,"acquired_yen"), used_yen: num(value.used_yen,"used_yen"), expired_yen: num(value.expired_yen,"expired_yen"), current_yen: num(value.current_yen,"current_yen"), scheduled_yen: num(value.scheduled_yen,"scheduled_yen"), waived_yen: num(value.waived_yen,"waived_yen"), uncertain_yen: num(value.uncertain_yen,"uncertain_yen"),
    has_unvalued: bool(value.has_unvalued,"has_unvalued"), history_partial: bool(value.history_partial,"history_partial"),
    account_keys: strArray(value.account_keys,"account_keys"), reward_ids: strArray(value.reward_ids,"reward_ids"), entitlement_ids: strArray(value.entitlement_ids,"entitlement_ids"), source_count: num(value.source_count,"source_count"),
    next_scheduled_on: optStr(value.next_scheduled_on,"next_scheduled_on"), next_expected_expires_on: optStr(value.next_expected_expires_on,"next_expected_expires_on"),
  };
}

export function parseYutaiBenefitSummary(value: unknown): YutaiBenefitSummary {
  if (!isObject(value) || value.schema_version !== 1 || !Array.isArray(value.items)) throw new Error("INVALID_YUTAI_BENEFIT_SUMMARY:root");
  const items = value.items.map(parseItem);
  const count = num(value.count,"count");
  if (count !== items.length) throw new Error("INVALID_YUTAI_BENEFIT_SUMMARY:count");
  return { schema_version:1, as_of:str(value.as_of,"as_of"), today:str(value.today,"today"), count, items };
}
