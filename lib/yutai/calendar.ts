import type { CalendarCardMemo } from "@/app/tools/_shared/yutai-selection";
import type { MemoItem } from "@/app/tools/yutai-memo/types";
import type { CommandDraft, CommandReceipt, MonthFields, ProfileFields, Workspace } from "./contracts";

export type CommandStep = (receipts: readonly CommandReceipt[]) => CommandDraft;
const fixed = (command: CommandDraft): CommandStep => () => command;
export function calendarProjection(workspace: Workspace, year: number) {
  const month = workspace.selected_month;
  const memoItems: MemoItem[] = workspace.profiles.filter(p => p.active).map(p => {
    const states = workspace.month_states.filter(s => s.profile_id === p.id);
    const cycle = workspace.cycles.find(c => c.profile_id === p.id && c.entitlement_year === year && c.entitlement_month === month);
    return { id: p.id, code: p.stock_code, name: p.display_name, crossType: p.cross_strategy,
      months: states.map(s => s.entitlement_month), tagIds: workspace.profile_tags.filter(t => t.profile_id === p.id).map(t => t.tag_id),
      createdAt: p.created_at, updatedAt: p.updated_at, priority: p.priority, memo: p.memo,
      preparationMonthsBefore: states.find(s => s.entitlement_month === month)?.preparation_months_before ?? undefined,
      entryTiming: p.entry_timing ?? undefined, relatedUrl: p.related_url ?? undefined,
      tenureRule: p.tenure_rule ?? undefined, acquired: cycle?.status === "prepared",
      acquiredMarkedAt: cycle?.prepared_at ?? undefined,
      acquiredEntitlementMonthKey: cycle ? `${year}-${String(month).padStart(2, "0")}` : undefined,
    };
  });
  const byId = new Map(workspace.profiles.map(p => [p.id, p]));
  const cardMemos: Record<string, CalendarCardMemo> = {};
  for (const state of workspace.month_states) {
    const profile = byId.get(state.profile_id);
    if (!profile) continue;
    cardMemos[`${profile.stock_code}:${state.entitlement_month}`] = {
      preparationMonthsBefore: state.preparation_months_before ?? undefined,
      requiredShares: state.required_shares ?? undefined, benefitValueYen: state.benefit_value_yen ?? undefined,
      longTermRequired: state.long_term_required, longTermBenefit: state.long_term_benefit, updatedAt: state.updated_at,
    };
  }
  // Preparation axis must inspect each month's setting, not a profile-wide scalar.
  const preparationItems = workspace.month_states.flatMap(s => {
    const profile = memoItems.find(p => p.id === s.profile_id);
    const lead = s.preparation_months_before;
    if (!profile || lead === null || ((s.entitlement_month - lead - 1 + 12) % 12) + 1 !== month) return [];
    return [{ ...profile, id: `${profile.id}:${s.entitlement_month}`, months: [s.entitlement_month], preparationMonthsBefore: lead }];
  });
  return { memoItems, cardMemos, preparationItems,
    addedKeys: new Set(memoItems.flatMap(p => p.months.map(m => `${p.code}:${m}`))),
    pickedCodes: new Set(workspace.effective_selections.filter(s => s.selection_status === "picked").map(s => s.stock_code)),
    passedCodes: new Set(workspace.effective_selections.filter(s => s.selection_status === "passed").map(s => s.stock_code)),
  };
}

export function selectionCommand(workspace: Workspace, code: string, status: "picked" | "passed" | "unreviewed"): CommandDraft {
  const month = workspace.selected_month;
  const current = workspace.selections.find(s => s.stock_code === code && s.entitlement_month === month);
  return { command_type: "set_selection", target: { stock_code: code, entitlement_month: month },
    payload: { selection_status: status }, expected_revision: current?.revision ?? 0 };
}

/** Missing profile creation is explicit; partial completion is retained by the action runner. */
export function ensureCalendarMonth(workspace: Workspace, code: string, name: string, month: number,
  patch: Partial<MonthFields> = {}): CommandStep[] {
  const profile = workspace.profiles.find(p => p.stock_code === code);
  if (profile && !profile.active) throw new Error("この銘柄は非表示のメモにあります。メモを復元してから操作してください。");
  const current = profile && workspace.month_states.find(s => s.profile_id === profile.id && s.entitlement_month === month);
  if (current) return Object.keys(patch).length ? [fixed({ command_type: "update_month_state", target: { id: current.id },
    expected_revision: current.revision, payload: patch })] : [];
  const steps: CommandStep[] = [];
  if (!profile) steps.push(fixed({ command_type: "create_profile", target: {}, expected_revision: 0,
    payload: { stock_code: code, display_name: name, cross_strategy: "未設定", priority: 2 } }));
  steps.push(receipts => ({ command_type: "create_month_state", target: {}, expected_revision: 0,
    payload: { ...patch, profile_id: profile?.id ?? receipts[0].target_id, entitlement_month: month } }));
  return steps;
}

export function cardMemoPatch(patch: Partial<Omit<CalendarCardMemo, "updatedAt">>): Partial<MonthFields> {
  const result: Partial<MonthFields> = {};
  if ("preparationMonthsBefore" in patch) result.preparation_months_before = patch.preparationMonthsBefore ?? null;
  if ("requiredShares" in patch) result.required_shares = patch.requiredShares ?? null;
  if ("benefitValueYen" in patch) result.benefit_value_yen = patch.benefitValueYen ?? null;
  if ("longTermRequired" in patch) result.long_term_required = patch.longTermRequired;
  if ("longTermBenefit" in patch) result.long_term_benefit = patch.longTermBenefit;
  return result;
}
export interface CalendarMemoDraft {
  name: string; crossType: ProfileFields["cross_strategy"]; priority: 1 | 2 | 3; memo: string;
  entryTiming: string; relatedUrl: string; tenureRule: string; preparationMonthsBefore: number | ""; acquired: boolean;
}
export function editCalendarMemo(workspace: Workspace, id: string, year: number, month: number,
  draft: CalendarMemoDraft, now: string): CommandStep[] {
  const profile = workspace.profiles.find(p => p.id === id);
  const state = workspace.month_states.find(s => s.profile_id === id && s.entitlement_month === month);
  if (!profile || !state) throw new Error("編集対象を再取得してください。");
  const cycle = workspace.cycles.find(c => c.profile_id === id && c.entitlement_year === year && c.entitlement_month === month);
  const steps: CommandStep[] = [];
  const candidate: Partial<ProfileFields> = { display_name: draft.name.trim() || profile.display_name, cross_strategy: draft.crossType,
    priority: draft.priority, memo: draft.memo, entry_timing: draft.entryTiming.trim() || null,
    related_url: draft.relatedUrl.trim() || null, tenure_rule: draft.tenureRule.trim() || null };
  const patch = Object.fromEntries(Object.entries(candidate).filter(([key, value]) => profile[key] !== value));
  if (Object.keys(patch).length) steps.push(fixed({ command_type: "update_profile", target: { id }, expected_revision: profile.revision, payload: patch }));
  const lead = draft.preparationMonthsBefore === "" ? null : draft.preparationMonthsBefore;
  if (state.preparation_months_before !== lead) steps.push(fixed({ command_type: "update_month_state", target: { id: state.id },
    expected_revision: state.revision, payload: { preparation_months_before: lead } }));
  if (draft.acquired !== (cycle?.status === "prepared")) {
    if (cycle && !["planned", "considering", "prepared", "cancelled", "skipped"].includes(cycle.status)) {
      throw new Error("権利確保後の仕込み履歴は、この画面から変更できません。");
    }
    steps.push(fixed(cycle ? { command_type: "update_cycle", target: { id: cycle.id }, expected_revision: cycle.revision,
      payload: { status: draft.acquired ? "prepared" : "planned", prepared_at: draft.acquired ? (cycle.prepared_at ?? now) : null } } :
      { command_type: "create_cycle", target: {}, expected_revision: 0,
        payload: { profile_id: id, entitlement_year: year, entitlement_month: month, status: "prepared", prepared_at: now } }));
  }
  return steps;
}
export function removeCalendarMonth(workspace: Workspace, profileId: string, month: number): CommandDraft {
  const state = workspace.month_states.find(s => s.profile_id === profileId && s.entitlement_month === month);
  if (!state) throw new Error("解除対象を再取得してください。");
  // Never delete profile/history/rewards just because its last visible month is removed.
  return { command_type: "delete_month_state", target: { id: state.id }, expected_revision: state.revision,
    payload: {}, note: `カレンダーから${month}月の登録解除。銘柄メモ・仕込み履歴・優待残高は保持。` };
}
