import type { CommandDraft, Cycle, CycleFields, Workspace } from "./contracts";

export const cycleStatuses = { considering: "検討中", planned: "予定", prepared: "仕込み済み", rights_secured: "権利確保",
  settled: "決済済み", received: "受取済み", skipped: "見送り", cancelled: "取消" } as const;
export const cycleDates = { planned_at: "予定日時", prepared_at: "仕込み日時", rights_secured_at: "権利確保日時",
  settled_at: "決済日時", received_at: "受取日時", skipped_at: "見送り日時" } as const;
export function cycleDraft(original?: Cycle): CycleFields {
  return { entitlement_year: original?.entitlement_year ?? 0, entitlement_month: original?.entitlement_month ?? 0,
    status: original?.status ?? "considering", planned_at: original?.planned_at ?? null, prepared_at: original?.prepared_at ?? null,
    rights_secured_at: original?.rights_secured_at ?? null, settled_at: original?.settled_at ?? null,
    received_at: original?.received_at ?? null, skipped_at: original?.skipped_at ?? null,
    quantity: original?.quantity ?? null, account_label: original?.account_label ?? null, note: original?.note ?? "" };
}
/** Display in device local time, but retain the original DB timestamp unless explicitly edited. */
export function localTimestamp(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error("日時を確認してください。");
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
export function timestampValue(input: string, original: string | null): string | null {
  if (input === localTimestamp(original)) return original;
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) throw new Error("日時を確認してください。");
  return d.toISOString();
}
export function saveCycle(snapshot: Workspace, profileId: string, original: Cycle | null, draft: CycleFields): CommandDraft | null {
  if (!snapshot.profiles.some(p => p.id === profileId) || (original && original.profile_id !== profileId)) throw new Error("編集対象を再取得してください。");
  if (!Number.isInteger(draft.entitlement_year) || draft.entitlement_year < 1 || draft.entitlement_year > 9999 ||
      !Number.isInteger(draft.entitlement_month) || draft.entitlement_month < 1 || draft.entitlement_month > 12) throw new Error("権利年（1〜9999）と権利月（1〜12）を入力してください。");
  if (!(draft.status in cycleStatuses)) throw new Error("状態を選択してください。");
  if (draft.quantity !== null && (!Number.isInteger(draft.quantity) || draft.quantity <= 0 || draft.quantity > 2147483647)) throw new Error("仕込み株数は正の整数で入力してください。空欄は未設定です。");
  for (const field of Object.keys(cycleDates) as (keyof typeof cycleDates)[]) {
    if (draft[field] !== null && !Number.isFinite(Date.parse(draft[field]))) throw new Error("日時を確認してください。");
  }
  if (draft.status === "prepared" && !draft.prepared_at) throw new Error("仕込み済みには仕込み日時が必要です。");
  if (snapshot.cycles.some(c => c.id !== original?.id && c.profile_id === profileId && c.entitlement_year === draft.entitlement_year && c.entitlement_month === draft.entitlement_month)) throw new Error("同じ銘柄・権利年月の履歴があります。既存の履歴を編集してください。");
  if (!original) return { command_type: "create_cycle", target: {}, expected_revision: 0, payload: { ...draft, profile_id: profileId } };
  const changed = Object.fromEntries(Object.entries(draft).filter(([key, value]) => original[key] !== value));
  return Object.keys(changed).length ? { command_type: "update_cycle", target: { id: original.id }, expected_revision: original.revision, payload: changed } : null;
}
export function deleteCycle(snapshot: Workspace, original: Cycle, reason: string): CommandDraft {
  if (snapshot.rewards.some(r => r.cycle_id === original.id)) throw new Error("優待残高に紐付いた履歴は削除できません。");
  if (!reason.trim()) throw new Error("削除理由を入力してください。");
  return { command_type: "delete_cycle", target: { id: original.id }, expected_revision: original.revision, payload: {}, note: reason.trim() };
}
