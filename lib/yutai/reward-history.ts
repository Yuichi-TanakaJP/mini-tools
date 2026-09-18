export type YutaiHistoryCategory = "acquired" | "used" | "expired" | "transfer" | "conversion" | "adjustment";

export type YutaiRewardHistoryItem = {
  event_id: string;
  occurred_at: string;
  event_type: string;
  event_category: YutaiHistoryCategory;
  reward_id: string;
  reward_title: string;
  company: string;
  account_id: string | null;
  account_key: string | null;
  benefit_key: string;
  display_title: string;
  native_delta: number;
  native_unit: string;
  unit_yen: number | null;
  yen_delta: number | null;
  event_note: string | null;
  operation_id: string | null;
  operation_type: string | null;
  operation_source: string | null;
  operation_note: string | null;
  merchant_name: string | null;
  merchant_amount_native: number | null;
  unattributed_amount_native: number | null;
  detail: string | null;
};

export type YutaiRewardHistory = {
  schema_version: 1;
  as_of: string;
  items: YutaiRewardHistoryItem[];
  next_before: string | null;
};

const categories = ["acquired","used","expired","transfer","conversion","adjustment"] as const;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function str(value: unknown, field: string) { if (typeof value !== "string") throw new Error(`INVALID_YUTAI_HISTORY:${field}`); return value; }
function optStr(value: unknown, field: string) { if (value === null) return null; return str(value, field); }
function num(value: unknown, field: string) { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_YUTAI_HISTORY:${field}`); return value; }
function optNum(value: unknown, field: string) { if (value === null) return null; return num(value, field); }
function category(value: unknown): YutaiHistoryCategory { const v = str(value,"event_category"); if (!categories.includes(v as YutaiHistoryCategory)) throw new Error("INVALID_YUTAI_HISTORY:event_category"); return v as YutaiHistoryCategory; }

function parseItem(value: unknown): YutaiRewardHistoryItem {
  if (!isObject(value)) throw new Error("INVALID_YUTAI_HISTORY:item");
  return {
    event_id:str(value.event_id,"event_id"), occurred_at:str(value.occurred_at,"occurred_at"), event_type:str(value.event_type,"event_type"), event_category:category(value.event_category),
    reward_id:str(value.reward_id,"reward_id"), reward_title:str(value.reward_title,"reward_title"), company:str(value.company,"company"),
    account_id:optStr(value.account_id,"account_id"), account_key:optStr(value.account_key,"account_key"), benefit_key:str(value.benefit_key,"benefit_key"), display_title:str(value.display_title,"display_title"),
    native_delta:num(value.native_delta,"native_delta"), native_unit:str(value.native_unit,"native_unit"), unit_yen:optNum(value.unit_yen,"unit_yen"), yen_delta:optNum(value.yen_delta,"yen_delta"),
    event_note:optStr(value.event_note,"event_note"), operation_id:optStr(value.operation_id,"operation_id"), operation_type:optStr(value.operation_type,"operation_type"), operation_source:optStr(value.operation_source,"operation_source"), operation_note:optStr(value.operation_note,"operation_note"),
    merchant_name:optStr(value.merchant_name,"merchant_name"), merchant_amount_native:optNum(value.merchant_amount_native,"merchant_amount_native"), unattributed_amount_native:optNum(value.unattributed_amount_native,"unattributed_amount_native"), detail:optStr(value.detail,"detail"),
  };
}

export function parseYutaiRewardHistory(value: unknown): YutaiRewardHistory {
  if (!isObject(value) || value.schema_version !== 1 || !Array.isArray(value.items)) throw new Error("INVALID_YUTAI_HISTORY:root");
  return { schema_version:1, as_of:str(value.as_of,"as_of"), items:value.items.map(parseItem), next_before:optStr(value.next_before,"next_before") };
}
