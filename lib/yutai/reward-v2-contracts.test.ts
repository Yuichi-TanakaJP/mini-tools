import { describe, expect, it } from "vitest";
import { parseRewardLedgerV2, parseRewardV2CommandResult } from "./reward-v2-contracts";

const valid = {
  schema_version: 2,
  as_of: "2026-09-13T00:00:00Z",
  today: "2026-09-13",
  counts: { accounts: 1, entitlements: 1, unassigned_rewards: 1 },
  accounts: [{
    id: "a", account_key: "quo", title: "QUO", benefit_kind: "stored_value", native_unit: "yen",
    expiry_policy: "none", rolling_expiry_days: null, rolling_expiry_months: null, allocation_policy: "fifo", status: "active",
    recorded_balance_native: 54000, available_balance_native: 54000, expired_unprocessed_native: 0, nearest_expiry: null, rolling_expires_on: null,
    opening_balance_native: 43500, tracked_granted_native: 0, tracked_consumed_native: 0, tracked_expired_native: 0,
    unclassified_adjustment_native: 10500, unclassified_increase_native: 13000, unclassified_decrease_native: 2500,
    coverage_state: "history_partial", revision: 2,
    lots: [{ id:"l", entitlement_id:null, profile_id:null, cycle_id:null, title:"opening", company:"", granted_at:null, expires_on:null, track_mode:"amount", initial_value:43500, remaining_value:54000, unit_yen:null, coverage_state:"legacy_opening_balance", archived_at:null, revision:1 }],
  }],
  entitlements: [{
    id:"e", profile_id:null, cycle_id:null, account_id:"a", benefit_kind:"choice", status:"claim_required", native_quantity:1, native_unit:"choice",
    face_value_yen:null, user_value_yen:null, selected_option:null, claimed_at:null, activated_at:null, fulfilled_at:null,
    coverage_state:"native_complete", memo:"", revision:1,
    deadlines:[{id:"d",deadline_type:"claim_by",due_on:"2026-09-30",completed_at:null,note:"",revision:1}],
  }],
  unassigned_rewards: [{ id:"legacy",title:"EDION",company:"EDION",expires_on:"2027-06-30",track_mode:"amount",initial_value:3000,remaining_value:3000,unit_yen:null,coverage_state:"history_partial",archived_at:null,revision:1 }],
};

describe("Reward Model v2 wire parser", () => {
  it("keeps opening balance, tracked grants, and unclassified legacy adjustments separate", () => {
    const parsed = parseRewardLedgerV2(valid);
    expect(parsed.accounts[0]).toMatchObject({
      recorded_balance_native:54000,
      opening_balance_native:43500,
      tracked_granted_native:0,
      unclassified_adjustment_native:10500,
      unclassified_increase_native:13000,
      unclassified_decrease_native:2500,
    });
    expect(parsed.entitlements[0].deadlines[0].deadline_type).toBe("claim_by");
  });
  it("accepts rolling_on_grant as an explicit expiry policy", () => {
    const rolling = structuredClone(valid);
    rolling.accounts[0].expiry_policy = "rolling_on_grant";
    rolling.accounts[0].rolling_expiry_months = 12;
    rolling.accounts[0].nearest_expiry = "2027-03-23";
    rolling.accounts[0].rolling_expires_on = "2027-03-23";
    expect(parseRewardLedgerV2(rolling).accounts[0].expiry_policy).toBe("rolling_on_grant");
  });
  it("accepts unknown entitlement lifecycle state without inventing timestamps", () => {
    const legacy = structuredClone(valid);
    legacy.entitlements[0].status = "unknown";
    legacy.entitlements[0].coverage_state = "history_partial";
    legacy.entitlements[0].claimed_at = null;
    legacy.entitlements[0].activated_at = null;
    legacy.entitlements[0].fulfilled_at = null;
    const parsed = parseRewardLedgerV2(legacy);
    expect(parsed.entitlements[0]).toMatchObject({ status:"unknown", coverage_state:"history_partial", claimed_at:null, activated_at:null, fulfilled_at:null });
  });
  it("accepts entitlement-only legacy link receipts", () => {
    const receipt = {
      schema_version:2, request_id:"r", replayed:false, command_type:"link_legacy_entitlement",
      target_id:"legacy", entitlement_id:"entitlement", revision:2, operation_id:null, allocations:[],
    };
    expect(parseRewardV2CommandResult(receipt)).toMatchObject({
      command_type:"link_legacy_entitlement", target_id:"legacy", entitlement_id:"entitlement", revision:2,
    });
  });
  it("rejects an unsupported schema, enum, missing additive field, or inconsistent count instead of silently falling back", () => {
    expect(() => parseRewardLedgerV2({ ...valid, schema_version:1 })).toThrow(/INVALID_V2_WIRE/);
    const broken = structuredClone(valid); broken.accounts[0].expiry_policy = "mystery";
    expect(() => parseRewardLedgerV2(broken)).toThrow(/INVALID_V2_WIRE/);
    const missing = structuredClone(valid) as Record<string, unknown> & { accounts: Record<string, unknown>[] };
    delete missing.accounts[0].unclassified_adjustment_native;
    expect(() => parseRewardLedgerV2(missing)).toThrow(/INVALID_V2_WIRE:account.unclassified_adjustment_native/);
    expect(() => parseRewardLedgerV2({ ...valid, counts:{...valid.counts,accounts:2} })).toThrow(/INVALID_V2_WIRE:counts/);
  });
  it("rejects malformed command receipts instead of coercing them", () => {
    const receipt = { schema_version:2, request_id:"r", replayed:false, command_type:"create_account", target_id:"a", revision:1 };
    expect(parseRewardV2CommandResult(receipt).replayed).toBe(false);
    expect(() => parseRewardV2CommandResult({ ...receipt, replayed:"false" })).toThrow(/INVALID_V2_WIRE:replayed/);
    expect(() => parseRewardV2CommandResult({ ...receipt, command_type:"unknown" })).toThrow(/INVALID_V2_WIRE:command_type/);
    expect(() => parseRewardV2CommandResult({ ...receipt, command_type:"link_legacy_entitlement", entitlement_id:12 })).toThrow(/INVALID_V2_WIRE:entitlement_id/);
  });
});
