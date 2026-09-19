/** Wire contract: stock-notes PRs 188, 190, 191. Never normalize missing values to zero. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Strategy = "未設定" | "長期優遇なし" | "単発クロス" | "連続クロス" | "先行クロス" | "1株放置";
export type SelectionStatus = "picked" | "passed" | "unreviewed";
export type TrackMode = "count" | "amount";
export interface ProfileFields {
  display_name: string; cross_strategy: Strategy; priority: 1 | 2 | 3; memo: string; active: boolean;
  one_share_started_on: string | null; one_share_started_legacy_text: string | null;
  entry_timing: string | null; default_preparation_months_before: number | null;
  tenure_rule: string | null; related_url: string | null; official_benefit_url: string | null;
}
export interface MonthFields {
  preparation_months_before: number | null; required_shares: number | null;
  benefit_value_yen: number | null; long_term_required: boolean;
  long_term_benefit: boolean; month_memo: string;
}
export interface CycleFields {
  entitlement_year: number; entitlement_month: number;
  status: "considering" | "planned" | "prepared" | "rights_secured" | "settled" | "received" | "skipped" | "cancelled";
  planned_at: string | null; prepared_at: string | null; rights_secured_at: string | null;
  settled_at: string | null; received_at: string | null; skipped_at: string | null;
  quantity: number | null; account_label: string | null; note: string;
}
export interface RewardFields {
  title: string; company: string; expires_on: string | null; unit_yen: number | null;
  memo: string; link: string | null;
}
type Row = { id: string; revision: number; created_at: string; updated_at: string };
export type Profile = Row & ProfileFields & { stock_code: string; portfolio_instrument_id: string | null };
export type MonthState = Row & MonthFields & { profile_id: string; entitlement_month: number };
export type Cycle = Row & CycleFields & { profile_id: string };
export type Reward = Row & RewardFields & {
  profile_id: string | null; cycle_id: string | null; track_mode: TrackMode;
  initial_value: number; remaining_value: number; archived_at: string | null;
};
export interface Workspace {
  schema_version: 1; selected_month: number; as_of: string; counts: Record<string, number>;
  profiles: Profile[]; month_states: MonthState[]; cycles: Cycle[];
  tags: (Row & { name: string })[];
  profile_tags: { profile_id: string; tag_id: string; created_at: string }[];
  rewards: Reward[];
  reward_events: { id: string; reward_id: string; track_mode: TrackMode;
    event_type: "received" | "consumed" | "restocked" | "adjusted";
    delta_value: number; occurred_at: string; note: string | null; created_at: string }[];
  selections: (Row & { stock_code: string; entitlement_month: number | null; selection_status: SelectionStatus })[];
  effective_selections: { stock_code: string; selection_status: SelectionStatus; selection_scope: "global" | "monthly" }[];
}
type Id = { id: string };
type Empty = Record<string, never>;
type Operation<T, P> = { target: T; payload: P };
interface Operations {
  set_selection: Operation<{ stock_code: string; entitlement_month: number | null }, { selection_status: SelectionStatus }>;
  update_profile: Operation<Id, Partial<ProfileFields>>;
  update_month_state: Operation<Id, Partial<MonthFields>>;
  update_cycle: Operation<Id, Partial<CycleFields>>;
  update_reward: Operation<Id, Partial<RewardFields>>;
  consume_reward: Operation<Id, { value: number }>;
  restock_reward: Operation<Id, { value: number }>;
  adjust_reward_balance: Operation<Id, { value: number }>;
  set_reward_archived: Operation<Id, { archived: boolean }>;
  create_profile: Operation<Empty, Pick<ProfileFields, "display_name" | "cross_strategy" | "priority"> & Partial<ProfileFields> & { stock_code: string }>;
  create_month_state: Operation<Empty, Partial<MonthFields> & { profile_id: string; entitlement_month: number }>;
  create_cycle: Operation<Empty, Pick<CycleFields, "entitlement_year" | "entitlement_month" | "status"> & Partial<CycleFields> & { profile_id: string }>;
  create_reward: Operation<Empty, Pick<RewardFields, "title"> & Partial<RewardFields> & { track_mode: TrackMode; initial_value: number; profile_id?: string | null; cycle_id?: string | null }>;
  create_tag: Operation<Empty, { name: string }>;
  update_tag: Operation<Id, { name: string }>;
  set_profile_tags: Operation<Id, { tag_ids: string[] }>;
  delete_profile: Operation<Id, Empty>;
  delete_month_state: Operation<Id, Empty>;
  delete_cycle: Operation<Id, Empty>;
  delete_reward: Operation<Id, Empty>;
  delete_tag: Operation<Id, Empty>;
  clear_selection: Operation<Id, Empty>;
  remove_reward_event: Operation<Id, { event_id: string }>;
  change_reward_mode: Operation<Id, { track_mode: TrackMode; value: number; unit_yen: number | null }>;
}
type ReasonRequired = `delete_${string}` | "clear_selection" | "remove_reward_event" | "change_reward_mode" | "adjust_reward_balance";
export type CommandDraft = { [K in keyof Operations]: Operations[K] & {
  command_type: K; expected_revision: number;
} & (K extends ReasonRequired ? { note: string } : { note?: string }) }[keyof Operations];
export type Command = CommandDraft & { schema_version: 1; request_id: string; occurred_at: string; source: "mini_tools" };
export interface CommandReceipt {
  schema_version: 1; request_id: string; command_type: CommandDraft["command_type"];
  target_id: string; revision: number | null; event_id: string; replayed: boolean;
  before: Json; after: Json;
}

export function checkMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("INVALID_MONTH");
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
// Validate the transport envelope and row primitives without coercion. DB constraints
// remain authoritative for domain rules; additive fields are safe to retain.
const base = "id:s revision:n created_at:s updated_at:s";
const shapes = {
  profiles: `${base} stock_code:s display_name:s portfolio_instrument_id:s? cross_strategy:s priority:n memo:s active:b one_share_started_on:s? one_share_started_legacy_text:s? entry_timing:s? default_preparation_months_before:n? tenure_rule:s? related_url:s? official_benefit_url:s?`,
  month_states: `${base} profile_id:s entitlement_month:n preparation_months_before:n? required_shares:n? benefit_value_yen:n? long_term_required:b long_term_benefit:b month_memo:s`,
  cycles: `${base} profile_id:s entitlement_year:n entitlement_month:n status:s planned_at:s? prepared_at:s? rights_secured_at:s? settled_at:s? received_at:s? skipped_at:s? quantity:n? account_label:s? note:s`,
  tags: `${base} name:s`,
  profile_tags: "profile_id:s tag_id:s created_at:s",
  rewards: `${base} profile_id:s? cycle_id:s? title:s company:s expires_on:s? track_mode:s initial_value:n remaining_value:n unit_yen:n? archived_at:s? memo:s link:s?`,
  reward_events: "id:s reward_id:s track_mode:s event_type:s delta_value:n occurred_at:s note:s? created_at:s",
  selections: `${base} stock_code:s entitlement_month:n? selection_status:s`,
  effective_selections: "stock_code:s selection_status:s selection_scope:s",
} as const;
const enums: Record<string, readonly unknown[]> = {
  cross_strategy: ["未設定", "長期優遇なし", "単発クロス", "連続クロス", "先行クロス", "1株放置"],
  priority: [1, 2, 3], track_mode: ["count", "amount"],
  selection_status: ["picked", "passed", "unreviewed"], selection_scope: ["global", "monthly"],
  status: ["considering", "planned", "prepared", "rights_secured", "settled", "received", "skipped", "cancelled"],
  event_type: ["received", "consumed", "restocked", "adjusted"],
};
export function parseWorkspace(value: unknown, month: number): Workspace {
  if (!isObject(value) || value.schema_version !== 1 || value.selected_month !== month ||
      typeof value.as_of !== "string" || !Number.isFinite(Date.parse(value.as_of)) || !isObject(value.counts)) {
    throw new Error("INVALID_RESPONSE");
  }
  for (const [key, shape] of Object.entries(shapes)) {
    const rows = value[key];
    if (!Array.isArray(rows) || value.counts[key] !== rows.length) throw new Error("INVALID_RESPONSE");
    for (const row of rows) {
      if (!isObject(row)) throw new Error("INVALID_RESPONSE");
      for (const field of shape.split(" ")) {
        const [name, kind] = field.split(":");
        const v = row[name];
        if (v === null && kind.endsWith("?")) continue;
        const valid = kind[0] === "s" ? typeof v === "string" : kind[0] === "b" ? typeof v === "boolean" : typeof v === "number" && Number.isFinite(v);
        if (!valid) throw new Error("INVALID_RESPONSE");
      }
      if ("revision" in row && (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1)) throw new Error("INVALID_RESPONSE");
      for (const [field, choices] of Object.entries(enums)) {
        if (field in row && !choices.includes(row[field])) throw new Error("INVALID_RESPONSE");
      }
      if ("entitlement_month" in row && row.entitlement_month !== null) checkMonth(row.entitlement_month as number);
    }
  }
  return value as unknown as Workspace;
}
export function parseReceipt(value: unknown, command: Command): CommandReceipt {
  const deleted = command.command_type.startsWith("delete_") || command.command_type === "clear_selection";
  const validRevision = isObject(value) && (deleted ? value.revision === null && value.after === null :
    Number.isSafeInteger(value.revision) && (value.revision as number) >= 1);
  if (!isObject(value) || value.schema_version !== 1 || value.request_id !== command.request_id ||
      value.command_type !== command.command_type || typeof value.target_id !== "string" ||
      typeof value.event_id !== "string" || !validRevision ||
      typeof value.replayed !== "boolean" || !("before" in value) || !("after" in value)) {
    throw new Error("INVALID_RESPONSE");
  }
  return value as unknown as CommandReceipt;
}
