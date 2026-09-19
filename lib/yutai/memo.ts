import type { CommandDraft, MonthFields, MonthState, Profile, ProfileFields } from "./contracts";

export type MemoProfileDraft = Pick<ProfileFields, "display_name" | "cross_strategy" | "priority" | "memo" |
  "entry_timing" | "tenure_rule" | "related_url" | "official_benefit_url" | "one_share_started_on">;
export function profileDraft(profile?: Profile): MemoProfileDraft {
  return { display_name: profile?.display_name ?? "", cross_strategy: profile?.cross_strategy ?? "未設定",
    priority: profile?.priority ?? 2, memo: profile?.memo ?? "", entry_timing: profile?.entry_timing ?? null,
    tenure_rule: profile?.tenure_rule ?? null, related_url: profile?.related_url ?? null,
    official_benefit_url: profile?.official_benefit_url ?? null, one_share_started_on: profile?.one_share_started_on ?? null };
}
export function saveProfile(original: Profile | null, code: string, draft: MemoProfileDraft): CommandDraft | null {
  if (!draft.display_name.trim()) throw new Error("銘柄名を入力してください。");
  const payload = { ...draft, display_name: draft.display_name.trim() };
  if (!original) {
    if (!/^[0-9A-Z]{4}$/.test(code.trim())) throw new Error("銘柄コードを4文字の英数字で入力してください。");
    return { command_type: "create_profile", target: {}, expected_revision: 0, payload: { ...payload, stock_code: code.trim() } };
  }
  if (code !== original.stock_code) throw new Error("既存銘柄のコードは変更できません。");
  const changed = Object.fromEntries(Object.entries(payload).filter(([key, value]) => original[key] !== value));
  return Object.keys(changed).length ? { command_type: "update_profile", target: { id: original.id },
    expected_revision: original.revision, payload: changed } : null;
}
export function setProfileActive(original: Profile, active: boolean): CommandDraft {
  return { command_type: "update_profile", target: { id: original.id }, expected_revision: original.revision, payload: { active } };
}
export function optionalNumber(value: string, field: string, lead = false): number | null {
  if (!value.trim()) return null;
  const result = Number(value);
  if (!Number.isFinite(result) || (lead ? !Number.isInteger(result) || result < 0 || result > 11 : result <= 0)) {
    throw new Error(`${field}は${lead ? "0〜11の整数" : "0より大きい数値"}で入力してください。空欄は未設定です。`);
  }
  return result;
}
export function monthDraft(state?: MonthState): MonthFields {
  return { preparation_months_before: state?.preparation_months_before ?? null, required_shares: state?.required_shares ?? null,
    benefit_value_yen: state?.benefit_value_yen ?? null, long_term_required: state?.long_term_required ?? false,
    long_term_benefit: state?.long_term_benefit ?? false, month_memo: state?.month_memo ?? "" };
}
export function saveMonth(original: MonthState | null, profileId: string, month: number, draft: MonthFields): CommandDraft | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("権利月を1〜12で指定してください。");
  if (!original) return { command_type: "create_month_state", target: {}, expected_revision: 0,
    payload: { ...draft, profile_id: profileId, entitlement_month: month } };
  if (original.profile_id !== profileId || original.entitlement_month !== month) throw new Error("編集対象が一致しません。");
  const changed = Object.fromEntries(Object.entries(draft).filter(([key, value]) => original[key] !== value));
  return Object.keys(changed).length ? { command_type: "update_month_state", target: { id: original.id },
    expected_revision: original.revision, payload: changed } : null;
}
