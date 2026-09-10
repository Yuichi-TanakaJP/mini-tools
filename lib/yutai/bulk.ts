import type { CommandDraft, Workspace } from "./contracts";
export type BulkOperation = "prepared" | "planned" | "delete";
/** Capture every revision before starting; never silently rebase a partially saved batch. */
export function bulkMemoCommands(data: Workspace, ids: readonly string[], operation: BulkOperation, ym: string, now: string): CommandDraft[] {
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("対象銘柄を選択してください。");
  const profiles = ids.map(id => { const p = data.profiles.find(p => p.id === id); if (!p) throw new Error("対象を再取得してください。"); return p; });
  if (operation === "delete") {
    if (ids.some(id => data.month_states.some(s => s.profile_id === id) || data.cycles.some(c => c.profile_id === id) || data.rewards.some(r => r.profile_id === id))) {
      throw new Error("月別設定・仕込み履歴・残高がある銘柄は削除できません。メモの非表示を利用してください。");
    }
    return profiles.map(p => ({ command_type: "delete_profile", target: { id: p.id }, expected_revision: p.revision, payload: {}, note: "選択銘柄の一括削除を確認" }));
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || Number(ym.slice(0, 4)) < 1 || !Number.isFinite(Date.parse(now))) throw new Error("権利年月を指定してください。");
  const year = Number(ym.slice(0, 4)); const month = Number(ym.slice(5));
  return profiles.flatMap(p => {
    if (!p.active || !data.month_states.some(s => s.profile_id === p.id && s.entitlement_month === month)) throw new Error(`${p.stock_code}の指定権利月が未登録です。`);
    const c = data.cycles.find(c => c.profile_id === p.id && c.entitlement_year === year && c.entitlement_month === month);
    if (c && !["considering", "planned", "prepared", "cancelled", "skipped"].includes(c.status)) throw new Error(`${p.stock_code}は権利確保後です。個別の履歴を確認してください。`);
    if (c?.status === operation || (!c && operation === "planned")) return [];
    const payload = { status: operation, prepared_at: operation === "prepared" ? c?.prepared_at ?? now : null };
    return [c ? { command_type: "update_cycle", target: { id: c.id }, expected_revision: c.revision, payload } as CommandDraft
      : { command_type: "create_cycle", target: {}, expected_revision: 0, payload: { ...payload, profile_id: p.id, entitlement_year: year, entitlement_month: month } } as CommandDraft];
  });
}

/** Older cycles already remain as history; advancing the displayed month must not rewrite them. */
export function pastPreparationCycles(data: Workspace, currentYm: string) {
  return data.cycles.filter(c => c.prepared_at && `${String(c.entitlement_year).padStart(4, "0")}-${String(c.entitlement_month).padStart(2, "0")}` < currentYm);
}
