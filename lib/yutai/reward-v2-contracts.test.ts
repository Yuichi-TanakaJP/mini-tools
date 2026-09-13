import { describe, expect, it } from "vitest";
import { parseRewardLedgerV2 } from "./reward-v2-contracts";

const valid = {
  schema_version: 2,
  as_of: "2026-09-13T00:00:00Z",
  today: "2026-09-13",
  counts: { accounts: 1, entitlements: 1, unassigned_rewards: 1 },
  accounts: [{
    id: "a", account_key: "quo", title: "QUO", benefit_kind: "stored_value", native_unit: "yen",
    expiry_policy: "none", rolling_expiry_days: null, rolling_expiry_months: null, allocation_policy: "fifo", status: "active",
    recorded_balance_native: 54000, available_balance_native: 54000, expired_unprocessed_native: 0, nearest_expiry: null, rolling_expires_on: null,
    opening_balance_native: 43500, tracked_granted_native: 10500, tracked_consumed_native: 0, tracked_expired_native: 0,
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
  it("keeps opening balance separate from tracked grants", () => {
    const parsed = parseRewardLedgerV2(valid);
    expect(parsed.accounts[0]).toMatchObject({ recorded_balance_native:54000, opening_balance_native:43500, tracked_granted_native:10500 });
    expect(parsed.entitlements[0].deadlines[0].deadline_type).toBe("claim_by");
  });
  it("rejects an unsupported schema or enum instead of silently falling back", () => {
    expect(() => parseRewardLedgerV2({ ...valid, schema_version:1 })).toThrow(/INVALID_V2_WIRE/);
    const broken = structuredClone(valid); broken.accounts[0].expiry_policy = "mystery";
    expect(() => parseRewardLedgerV2(broken)).toThrow(/INVALID_V2_WIRE/);
  });
});
