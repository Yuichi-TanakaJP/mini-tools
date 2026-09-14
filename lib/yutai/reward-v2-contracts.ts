export type RewardV2BenefitKind =
  | "stored_value" | "points" | "voucher" | "admission" | "discount" | "service_access"
  | "service_period" | "choice" | "goods" | "cashback" | "composite" | "other";
export type RewardV2ExpiryPolicy = "none" | "fixed_per_grant" | "rolling_inactivity" | "external_managed";
export type RewardV2AllocationPolicy = "fefo" | "fifo" | "manual" | "not_applicable";
export type RewardV2Coverage = "native_complete" | "legacy_opening_balance" | "history_partial" | "unknown";
export type RewardV2EntitlementStatus = "eligible" | "claim_required" | "claimed" | "activated" | "fulfilled" | "expired" | "waived" | "cancelled";
export type RewardV2DeadlineType = "claim_by" | "activate_by" | "book_by" | "usable_from" | "use_by" | "service_starts_at" | "service_ends_at";

export type RewardV2Lot = {
  id: string;
  entitlement_id: string | null;
  profile_id: string | null;
  cycle_id: string | null;
  title: string;
  company: string;
  granted_at: string | null;
  expires_on: string | null;
  track_mode: "count" | "amount";
  initial_value: number;
  remaining_value: number;
  unit_yen: number | null;
  coverage_state: RewardV2Coverage;
  archived_at: string | null;
  revision: number;
};

export type RewardV2Account = {
  id: string;
  account_key: string;
  title: string;
  benefit_kind: RewardV2BenefitKind;
  native_unit: string;
  expiry_policy: RewardV2ExpiryPolicy;
  rolling_expiry_days: number | null;
  rolling_expiry_months: number | null;
  allocation_policy: RewardV2AllocationPolicy;
  status: "active" | "archived";
  recorded_balance_native: number;
  available_balance_native: number;
  expired_unprocessed_native: number;
  nearest_expiry: string | null;
  rolling_expires_on: string | null;
  opening_balance_native: number;
  tracked_granted_native: number;
  tracked_consumed_native: number;
  tracked_expired_native: number;
  coverage_state: "native_complete" | "history_partial";
  revision: number;
  lots: RewardV2Lot[];
};

export type RewardV2Deadline = {
  id: string;
  deadline_type: RewardV2DeadlineType;
  due_on: string;
  completed_at: string | null;
  note: string;
  revision: number;
};

export type RewardV2Entitlement = {
  id: string;
  profile_id: string | null;
  cycle_id: string | null;
  account_id: string | null;
  benefit_kind: RewardV2BenefitKind;
  status: RewardV2EntitlementStatus;
  native_quantity: number | null;
  native_unit: string | null;
  face_value_yen: number | null;
  user_value_yen: number | null;
  selected_option: string | null;
  claimed_at: string | null;
  activated_at: string | null;
  fulfilled_at: string | null;
  coverage_state: RewardV2Coverage;
  memo: string;
  revision: number;
  deadlines: RewardV2Deadline[];
};

export type RewardV2LegacyReward = {
  id: string;
  title: string;
  company: string;
  expires_on: string | null;
  track_mode: "count" | "amount";
  initial_value: number;
  remaining_value: number;
  unit_yen: number | null;
  coverage_state: RewardV2Coverage;
  archived_at: string | null;
  revision: number;
};

export type RewardLedgerV2 = {
  schema_version: 2;
  as_of: string;
  today: string;
  counts: { accounts: number; entitlements: number; unassigned_rewards: number };
  accounts: RewardV2Account[];
  entitlements: RewardV2Entitlement[];
  unassigned_rewards: RewardV2LegacyReward[];
};

export type RewardV2CommandType =
  | "create_account" | "create_entitlement" | "add_deadline" | "set_entitlement_status"
  | "create_grant" | "link_legacy_reward" | "consume_account" | "consume_lot" | "expire_lot"
  | "expire_account" | "extend_account" | "move_account_value" | "select_entitlement_option" | "complete_deadline";
export type RewardV2CommandDraft = {
  command_type: RewardV2CommandType;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
  expected_revision: number;
  note?: string;
};
export type RewardV2CommandWire = RewardV2CommandDraft & {
  schema_version: 2;
  request_id: string;
  occurred_at: string;
  source: "mini_tools";
};
export type RewardV2CommandResult = {
  schema_version: 2;
  request_id: string;
  replayed: boolean;
  command_type: RewardV2CommandType;
  target_id: string;
  revision?: number | null;
  account_revision?: number;
  operation_id?: string | null;
  deadline_id?: string;
  allocations?: unknown[];
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function str(v: unknown, field: string) { if (typeof v !== "string") throw new Error(`INVALID_V2_WIRE:${field}`); return v; }
function optStr(v: unknown, field: string) { if (v === null) return null; return str(v, field); }
function num(v: unknown, field: string) { if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`INVALID_V2_WIRE:${field}`); return v; }
function integer(v: unknown, field: string) { const n = num(v, field); if (!Number.isSafeInteger(n)) throw new Error(`INVALID_V2_WIRE:${field}`); return n; }
function optNum(v: unknown, field: string) { if (v === null) return null; return num(v, field); }
function optInteger(v: unknown, field: string) { if (v === null) return null; return integer(v, field); }
function bool(v: unknown, field: string) { if (typeof v !== "boolean") throw new Error(`INVALID_V2_WIRE:${field}`); return v; }
function arr(v: unknown, field: string) { if (!Array.isArray(v)) throw new Error(`INVALID_V2_WIRE:${field}`); return v; }
function oneOf<T extends string>(v: unknown, values: readonly T[], field: string): T { const s = str(v, field); if (!values.includes(s as T)) throw new Error(`INVALID_V2_WIRE:${field}`); return s as T; }
const benefitKinds = ["stored_value","points","voucher","admission","discount","service_access","service_period","choice","goods","cashback","composite","other"] as const;
const coverages = ["native_complete","legacy_opening_balance","history_partial","unknown"] as const;
const commandTypes = ["create_account","create_entitlement","add_deadline","set_entitlement_status","create_grant","link_legacy_reward","consume_account","consume_lot","expire_lot","expire_account","extend_account","move_account_value","select_entitlement_option","complete_deadline"] as const;

function parseLot(v: unknown): RewardV2Lot {
  if (!isObject(v)) throw new Error("INVALID_V2_WIRE:lot");
  return {
    id: str(v.id,"lot.id"), entitlement_id: optStr(v.entitlement_id,"lot.entitlement_id"), profile_id: optStr(v.profile_id,"lot.profile_id"), cycle_id: optStr(v.cycle_id,"lot.cycle_id"),
    title: str(v.title,"lot.title"), company: str(v.company,"lot.company"), granted_at: optStr(v.granted_at,"lot.granted_at"), expires_on: optStr(v.expires_on,"lot.expires_on"),
    track_mode: oneOf(v.track_mode,["count","amount"] as const,"lot.track_mode"), initial_value: num(v.initial_value,"lot.initial_value"), remaining_value: num(v.remaining_value,"lot.remaining_value"),
    unit_yen: optNum(v.unit_yen,"lot.unit_yen"), coverage_state: oneOf(v.coverage_state,coverages,"lot.coverage_state"), archived_at: optStr(v.archived_at,"lot.archived_at"), revision: integer(v.revision,"lot.revision"),
  };
}
function parseAccount(v: unknown): RewardV2Account {
  if (!isObject(v)) throw new Error("INVALID_V2_WIRE:account");
  return {
    id:str(v.id,"account.id"), account_key:str(v.account_key,"account.account_key"), title:str(v.title,"account.title"), benefit_kind:oneOf(v.benefit_kind,benefitKinds,"account.benefit_kind"),
    native_unit:str(v.native_unit,"account.native_unit"), expiry_policy:oneOf(v.expiry_policy,["none","fixed_per_grant","rolling_inactivity","external_managed"] as const,"account.expiry_policy"),
    rolling_expiry_days:optInteger(v.rolling_expiry_days,"account.rolling_expiry_days"), rolling_expiry_months:optInteger(v.rolling_expiry_months,"account.rolling_expiry_months"),
    allocation_policy:oneOf(v.allocation_policy,["fefo","fifo","manual","not_applicable"] as const,"account.allocation_policy"), status:oneOf(v.status,["active","archived"] as const,"account.status"),
    recorded_balance_native:num(v.recorded_balance_native,"account.recorded_balance_native"), available_balance_native:num(v.available_balance_native,"account.available_balance_native"),
    expired_unprocessed_native:num(v.expired_unprocessed_native,"account.expired_unprocessed_native"), nearest_expiry:optStr(v.nearest_expiry,"account.nearest_expiry"), rolling_expires_on:optStr(v.rolling_expires_on,"account.rolling_expires_on"),
    opening_balance_native:num(v.opening_balance_native,"account.opening_balance_native"), tracked_granted_native:num(v.tracked_granted_native,"account.tracked_granted_native"), tracked_consumed_native:num(v.tracked_consumed_native,"account.tracked_consumed_native"), tracked_expired_native:num(v.tracked_expired_native,"account.tracked_expired_native"),
    coverage_state:oneOf(v.coverage_state,["native_complete","history_partial"] as const,"account.coverage_state"), revision:integer(v.revision,"account.revision"), lots:arr(v.lots,"account.lots").map(parseLot),
  };
}
function parseDeadline(v: unknown): RewardV2Deadline {
  if (!isObject(v)) throw new Error("INVALID_V2_WIRE:deadline");
  return { id:str(v.id,"deadline.id"), deadline_type:oneOf(v.deadline_type,["claim_by","activate_by","book_by","usable_from","use_by","service_starts_at","service_ends_at"] as const,"deadline.deadline_type"), due_on:str(v.due_on,"deadline.due_on"), completed_at:optStr(v.completed_at,"deadline.completed_at"), note:str(v.note,"deadline.note"), revision:integer(v.revision,"deadline.revision") };
}
function parseEntitlement(v: unknown): RewardV2Entitlement {
  if (!isObject(v)) throw new Error("INVALID_V2_WIRE:entitlement");
  return {
    id:str(v.id,"entitlement.id"), profile_id:optStr(v.profile_id,"entitlement.profile_id"), cycle_id:optStr(v.cycle_id,"entitlement.cycle_id"), account_id:optStr(v.account_id,"entitlement.account_id"), benefit_kind:oneOf(v.benefit_kind,benefitKinds,"entitlement.benefit_kind"),
    status:oneOf(v.status,["eligible","claim_required","claimed","activated","fulfilled","expired","waived","cancelled"] as const,"entitlement.status"), native_quantity:optNum(v.native_quantity,"entitlement.native_quantity"), native_unit:optStr(v.native_unit,"entitlement.native_unit"),
    face_value_yen:optNum(v.face_value_yen,"entitlement.face_value_yen"), user_value_yen:optNum(v.user_value_yen,"entitlement.user_value_yen"), selected_option:optStr(v.selected_option,"entitlement.selected_option"), claimed_at:optStr(v.claimed_at,"entitlement.claimed_at"), activated_at:optStr(v.activated_at,"entitlement.activated_at"), fulfilled_at:optStr(v.fulfilled_at,"entitlement.fulfilled_at"), coverage_state:oneOf(v.coverage_state,coverages,"entitlement.coverage_state"), memo:str(v.memo,"entitlement.memo"), revision:integer(v.revision,"entitlement.revision"), deadlines:arr(v.deadlines,"entitlement.deadlines").map(parseDeadline),
  };
}
function parseLegacy(v: unknown): RewardV2LegacyReward {
  if (!isObject(v)) throw new Error("INVALID_V2_WIRE:legacy");
  return { id:str(v.id,"legacy.id"), title:str(v.title,"legacy.title"), company:str(v.company,"legacy.company"), expires_on:optStr(v.expires_on,"legacy.expires_on"), track_mode:oneOf(v.track_mode,["count","amount"] as const,"legacy.track_mode"), initial_value:num(v.initial_value,"legacy.initial_value"), remaining_value:num(v.remaining_value,"legacy.remaining_value"), unit_yen:optNum(v.unit_yen,"legacy.unit_yen"), coverage_state:oneOf(v.coverage_state,coverages,"legacy.coverage_state"), archived_at:optStr(v.archived_at,"legacy.archived_at"), revision:integer(v.revision,"legacy.revision") };
}
export function parseRewardLedgerV2(value: unknown): RewardLedgerV2 {
  if (!isObject(value) || value.schema_version !== 2 || !isObject(value.counts)) throw new Error("INVALID_V2_WIRE:root");
  const accounts = arr(value.accounts,"accounts").map(parseAccount);
  const entitlements = arr(value.entitlements,"entitlements").map(parseEntitlement);
  const unassignedRewards = arr(value.unassigned_rewards,"unassigned_rewards").map(parseLegacy);
  const counts = {
    accounts: integer(value.counts.accounts,"counts.accounts"),
    entitlements: integer(value.counts.entitlements,"counts.entitlements"),
    unassigned_rewards: integer(value.counts.unassigned_rewards,"counts.unassigned_rewards"),
  };
  if (counts.accounts !== accounts.length || counts.entitlements !== entitlements.length || counts.unassigned_rewards !== unassignedRewards.length) throw new Error("INVALID_V2_WIRE:counts");
  return { schema_version:2, as_of:str(value.as_of,"as_of"), today:str(value.today,"today"), counts, accounts, entitlements, unassigned_rewards:unassignedRewards };
}
export function parseRewardV2CommandResult(value: unknown): RewardV2CommandResult {
  if (!isObject(value) || value.schema_version !== 2) throw new Error("INVALID_V2_COMMAND_RESULT");
  return {
    schema_version:2,
    request_id:str(value.request_id,"request_id"),
    replayed:bool(value.replayed,"replayed"),
    command_type:oneOf(value.command_type,commandTypes,"command_type"),
    target_id:str(value.target_id,"target_id"),
    revision:value.revision === undefined || value.revision === null ? null : integer(value.revision,"revision"),
    account_revision:value.account_revision === undefined ? undefined : integer(value.account_revision,"account_revision"),
    operation_id:value.operation_id === undefined || value.operation_id === null ? null : str(value.operation_id,"operation_id"),
    deadline_id:value.deadline_id === undefined ? undefined : str(value.deadline_id,"deadline_id"),
    allocations:value.allocations === undefined ? undefined : arr(value.allocations,"allocations"),
  };
}
