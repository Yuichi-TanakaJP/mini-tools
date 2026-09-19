import { buildCalendarCells } from "@/app/tools/yutai-dashboard/calendar";
import type { ArchivedMemoItem, MemoItem } from "@/app/tools/yutai-memo/types";
import type { MemoEditDraft } from "@/app/tools/_shared/yutai-memo-edit";
import { calendarProjection, editCalendarMemo, ensureCalendarMonth, selectionCommand, type CommandStep } from "./calendar";
import { checkMonth, type ProfileFields, type SelectionStatus, type Workspace } from "./contracts";

export function dashboardSelection(workspace: Workspace, code: string, month: number): SelectionStatus {
  checkMonth(month);
  return (workspace.selections.find(s => s.stock_code === code && s.entitlement_month === month)
    ?? workspace.selections.find(s => s.stock_code === code && s.entitlement_month === null))?.selection_status ?? "unreviewed";
}
export function dashboardSelectionCommand(workspace: Workspace, code: string, month: number, status: SelectionStatus) {
  checkMonth(month);
  return selectionCommand({ ...workspace, selected_month: month }, code, status);
}
export function dashboardProjection(workspace: Workspace, year: number) {
  const base = calendarProjection(workspace, year);
  const memoItems = base.memoItems.map(item => {
    const p = workspace.profiles.find(p => p.id === item.id)!;
    return { ...item, acquired: false, acquiredMarkedAt: undefined, acquiredEntitlementMonthKey: undefined,
      oneShareStartedAt: p.one_share_started_on?.slice(0, 7) ?? p.one_share_started_legacy_text ?? undefined };
  });
  const archivedItems: ArchivedMemoItem[] = workspace.cycles.flatMap(c => {
    const p = workspace.profiles.find(p => p.id === c.profile_id);
    if (!p || !c.prepared_at || !["prepared", "rights_secured", "settled", "received"].includes(c.status)) return [];
    return [{ id: c.id, memoId: p.id, code: p.stock_code, name: p.display_name, acquiredAt: c.prepared_at,
      entitlementMonthKey: `${c.entitlement_year}-${String(c.entitlement_month).padStart(2, "0")}`, note: c.note }];
  });
  const monthlyItems = workspace.month_states.flatMap(s => {
    const item = memoItems.find(p => p.id === s.profile_id);
    if (!item) return [];
    const cycle = workspace.cycles.find(c => c.profile_id === item.id && c.entitlement_year === year && c.entitlement_month === s.entitlement_month);
    return [{ ...item, months: [s.entitlement_month], preparationMonthsBefore: s.preparation_months_before ?? undefined,
      acquired: cycle?.status === "prepared", acquiredMarkedAt: cycle?.prepared_at ?? undefined,
      acquiredEntitlementMonthKey: cycle ? `${year}-${String(s.entitlement_month).padStart(2, "0")}` : undefined }];
  });
  return { ...base, memoItems, monthlyItems, archivedItems };
}

/** Merge each month's independent plan; use explicit cycle years, including removed month registrations. */
export function dashboardCalendarCells(workspace: Workspace, memo: MemoItem, year: number, now: string) {
  const projected = dashboardProjection(workspace, year);
  const history = projected.archivedItems.filter(a => a.memoId === memo.id);
  const months = new Set([...memo.months, ...history.map(a => Number(a.entitlementMonthKey!.slice(5)))]);
  const cells = buildCalendarCells({ ...memo, months: [...months], preparationMonthsBefore: undefined, acquired: false }, history, year, now);
  for (const cell of cells) { cell.entitlement = false; cell.prepCompleted = false; }
  for (const item of projected.monthlyItems.filter(item => item.id === memo.id)) {
    const plan = buildCalendarCells({ ...item, acquired: false }, [], year, now);
    plan.forEach((cell, i) => { cells[i].entitlement ||= cell.entitlement; cells[i].prepStart ||= cell.prepStart; cells[i].band ||= cell.band; });
  }
  // The preparation dot belongs to the actual execution year, not the rights year.
  for (const entry of history) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date(entry.acquiredAt));
    if (Number(parts.find(p => p.type === "year")?.value) === year) cells[Number(parts.find(p => p.type === "month")?.value) - 1].prepCompleted = true;
  }
  return cells;
}

function oneSharePatch(value: string): Pick<ProfileFields, "one_share_started_on" | "one_share_started_legacy_text"> {
  const text = value.trim();
  if (!text) return { one_share_started_on: null, one_share_started_legacy_text: null };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) throw new Error("1株保有開始は年月で指定してください。既存の年不明メモは変更しなければ保持します。");
  return { one_share_started_on: `${text}-01`, one_share_started_legacy_text: null };
}
export function dashboardInlineEdit(workspace: Workspace, code: string, name: string, month: number, patch: Partial<MemoEditDraft>): CommandStep[] {
  checkMonth(month);
  const p = workspace.profiles.find(p => p.stock_code === code);
  const profilePatch: Partial<ProfileFields> = {};
  if (patch.crossType !== undefined) profilePatch.cross_strategy = patch.crossType;
  if (patch.oneShareStartedAt !== undefined) Object.assign(profilePatch, oneSharePatch(patch.oneShareStartedAt));
  const steps = ensureCalendarMonth(workspace, code, name, month, patch.preparationMonthsBefore !== undefined
    ? { preparation_months_before: patch.preparationMonthsBefore === "" ? null : patch.preparationMonthsBefore } : {});
  if (Object.keys(profilePatch).length) steps.push(receipts => ({ command_type: "update_profile",
    target: { id: p?.id ?? receipts[0].target_id }, expected_revision: p?.revision ?? receipts[0].revision!, payload: profilePatch }));
  return steps;
}

export function dashboardEditMemo(workspace: Workspace, id: string, year: number, month: number, draft: MemoEditDraft, now: string): CommandStep[] {
  const profile = workspace.profiles.find(p => p.id === id);
  if (!profile) throw new Error("編集対象を再取得してください。");
  const key = `${year}-${String(month).padStart(2, "0")}`;
  if (draft.acquired && draft.acquiredEntitlementMonthKey !== key) throw new Error(`この行は${key}の編集です。別の年月の履歴は優待メモから編集してください。`);
  const original = profile.one_share_started_on?.slice(0, 7) ?? profile.one_share_started_legacy_text ?? "";
  const patch = original === draft.oneShareStartedAt.trim() ? {} : oneSharePatch(draft.oneShareStartedAt);
  const steps = editCalendarMemo(workspace, id, year, month, draft, now);
  // Merge into the profile command to avoid a second write using the same revision.
  if (Object.keys(patch).length) {
    const index = steps.findIndex(step => step([]).command_type === "update_profile");
    if (index >= 0) {
      const command = steps[index]([]);
      if (command.command_type === "update_profile") steps[index] = () => ({ ...command, payload: { ...command.payload, ...patch } });
    } else steps.unshift(() => ({ command_type: "update_profile", target: { id }, expected_revision: profile.revision, payload: patch }));
  }
  return steps;
}
