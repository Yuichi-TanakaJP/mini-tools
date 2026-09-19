import { describe, expect, it } from "vitest";
import { monthDraft, optionalNumber, profileDraft, saveMonth, saveProfile, setProfileActive } from "./memo";
import type { MonthState, Profile } from "./contracts";
const profile: Profile = { ...profileDraft(), id: "p", stock_code: "1234", display_name: "test", active: true,
  portfolio_instrument_id: null, one_share_started_legacy_text: "2020年ごろ", default_preparation_months_before: 3,
  revision: 8, created_at: "2026-01-01", updated_at: "2026-01-01" };
const month: MonthState = { ...monthDraft(), id: "m", profile_id: "p", entitlement_month: 9, required_shares: 100,
  benefit_value_yen: 1234.5, revision: 7, created_at: "2026-01-01", updated_at: "2026-01-01" };
describe("memo DB editing", () => {
  it("uses approved new defaults", () => {
    expect(saveProfile(null, "1234", { ...profileDraft(), display_name: "new" })).toMatchObject({
      command_type: "create_profile", expected_revision: 0, payload: { cross_strategy: "未設定", priority: 2 } });
  });
  it("sends only changed profile fields with the opening revision", () => {
    expect(saveProfile(profile, "1234", { ...profileDraft(profile), memo: "changed" })).toEqual({
      command_type: "update_profile", target: { id: "p" }, expected_revision: 8, payload: { memo: "changed" } });
    expect(profile.one_share_started_legacy_text).toBe("2020年ごろ");
  });
  it("does not write an unchanged form", () => {
    expect(saveProfile(profile, "1234", profileDraft(profile))).toBeNull();
    expect(saveMonth(month, "p", 9, monthDraft(month))).toBeNull();
  });
  it("rejects missing names or codes and identity changes", () => {
    expect(() => saveProfile(null, "1234", profileDraft())).toThrow();
    expect(() => saveProfile(null, "", profileDraft(profile))).toThrow();
    expect(() => saveProfile(profile, "9999", profileDraft(profile))).toThrow();
  });
  it("hides a profile without deleting its monthly values or history", () => {
    expect(setProfileActive(profile, false)).toEqual({ command_type: "update_profile", target: { id: "p" }, expected_revision: 8, payload: { active: false } });
  });
  it("retains decimal values and unknown versus zero", () => {
    expect(optionalNumber("1234.5", "value")).toBe(1234.5);
    expect(optionalNumber("", "value")).toBeNull();
    expect(optionalNumber("0", "lead", true)).toBe(0);
    expect(optionalNumber("11", "lead", true)).toBe(11);
  });
  it.each(["0", "-1", "NaN", "Infinity"])("rejects invalid manual value %s", value => {
    expect(() => optionalNumber(value, "value")).toThrow();
  });
  it.each(["12", "-1", "1.5"])("rejects invalid lead %s", value => {
    expect(() => optionalNumber(value, "lead", true)).toThrow();
  });
  it("updates only the chosen month's changed fields", () => {
    expect(saveMonth(month, "p", 9, { ...monthDraft(month), benefit_value_yen: 5000 })).toEqual({
      command_type: "update_month_state", target: { id: "m" }, expected_revision: 7, payload: { benefit_value_yen: 5000 } });
    expect(month.required_shares).toBe(100);
  });
  it("clears a value explicitly without turning it into zero", () => {
    expect(saveMonth(month, "p", 9, { ...monthDraft(month), required_shares: null })).toMatchObject({ payload: { required_shares: null } });
  });
  it("creates a missing month and rejects mismatched targets", () => {
    expect(saveMonth(null, "p", 12, monthDraft())).toMatchObject({ command_type: "create_month_state", payload: { profile_id: "p", entitlement_month: 12 } });
    expect(() => saveMonth(month, "p", 8, monthDraft())).toThrow();
    expect(() => saveMonth(null, "p", 0, monthDraft())).toThrow();
  });
});
