import type { CommandDraft, Reward, RewardFields, TrackMode, Workspace } from "./contracts";

/** Parse decimal text without rounding away user input; amounts are limited to safe cents. */
export function rewardNumber(input: string, mode: TrackMode, positive = false): number {
  const text = input.trim();
  if (!(mode === "count" ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(text)) throw new Error(mode === "count" ? "枚数は整数で入力してください。" : "金額は小数2桁までで入力してください。");
  const [whole, fraction = ""] = text.split(".");
  const scaled = mode === "count" ? BigInt(whole) : BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("安全に扱える数値の範囲を超えています。");
  if (positive && scaled === BigInt(0)) throw new Error("0より大きい値を入力してください。");
  const result = Number(text);
  if (mode === "amount") {
    const [serializedWhole, serializedFraction = ""] = String(result).split(".");
    if (serializedFraction.length > 2 || BigInt(serializedWhole) * BigInt(100) + BigInt(serializedFraction.padEnd(2, "0")) !== scaled) throw new Error("精度を保って送信できる数値の範囲を超えています。");
  }
  return result;
}
export function rewardFields(original?: Reward): RewardFields {
  return { title: original?.title ?? "", company: original?.company ?? "", expires_on: original?.expires_on ?? null,
    unit_yen: original?.unit_yen ?? null, memo: original?.memo ?? "", link: original?.link ?? null };
}
export function saveReward(snapshot: Workspace, original: Reward | null, fields: RewardFields,
  creation: { mode: TrackMode; initial: string; profileId: string | null; cycleId: string | null }): CommandDraft | null {
  if (!fields.title.trim()) throw new Error("優待名を入力してください。");
  if (fields.expires_on && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.expires_on) ||
      !Number.isFinite(Date.parse(fields.expires_on)) || new Date(fields.expires_on).toISOString().slice(0, 10) !== fields.expires_on)) throw new Error("期限日を確認してください。");
  if (fields.link && fields.link !== original?.link && !/^https?:\/\//i.test(fields.link.trim())) throw new Error("URLはhttpまたはhttpsで入力してください。");
  const mode = original?.track_mode ?? creation.mode;
  if (fields.unit_yen !== null) rewardNumber(String(fields.unit_yen), "amount");
  if (mode === "amount" && fields.unit_yen !== null) throw new Error("金額管理では1枚の額面は設定できません。");
  const payload = { ...fields, title: fields.title.trim() };
  if (original) {
    const changed = Object.fromEntries(Object.entries(payload).filter(([key, value]) => original[key] !== value));
    return Object.keys(changed).length ? { command_type: "update_reward", target: { id: original.id }, expected_revision: original.revision, payload: changed } : null;
  }
  if (creation.profileId && !snapshot.profiles.some(p => p.id === creation.profileId)) throw new Error("銘柄を再取得してください。");
  if (creation.cycleId && !snapshot.cycles.some(c => c.id === creation.cycleId && c.profile_id === creation.profileId)) throw new Error("仕込み履歴と銘柄が一致しません。");
  return { command_type: "create_reward", target: {}, expected_revision: 0, payload: { ...payload, track_mode: mode,
    initial_value: rewardNumber(creation.initial, mode), profile_id: creation.profileId, cycle_id: creation.cycleId } };
}
export type RewardAction = "consume" | "restock" | "adjust" | "mode" | "delete" | "remove";
export const rewardActions: Record<RewardAction, string> = { consume: "使う", restock: "補充", adjust: "残高訂正", mode: "管理単位を変更", delete: "優待を削除", remove: "履歴を取り消す" };
export function rewardAction(snapshot: Workspace, reward: Reward, kind: RewardAction,
  input: { value: string; reason: string; mode: TrackMode; unit: string; eventId?: string }): CommandDraft {
  const base = { target: { id: reward.id }, expected_revision: reward.revision };
  if (kind !== "delete" && reward.archived_at) throw new Error("先にアーカイブを解除してください。");
  const reason = input.reason.trim();
  if (["adjust", "mode", "delete", "remove"].includes(kind) && !reason) throw new Error("理由を入力してください。");
  if (kind === "delete") return { ...base, command_type: "delete_reward", payload: {}, note: reason };
  if (kind === "remove") {
    const event = snapshot.reward_events.find(e => e.id === input.eventId && e.reward_id === reward.id);
    if (!event) throw new Error("取消対象を再取得してください。");
    if (reward.remaining_value - event.delta_value < 0) throw new Error("取消後の残高がマイナスになるため取り消せません。");
    return { ...base, command_type: "remove_reward_event", payload: { event_id: event.id }, note: reason };
  }
  if (kind === "mode") {
    if (input.mode === reward.track_mode) throw new Error("現在と異なる管理単位を選択してください。");
    return { ...base, command_type: "change_reward_mode", payload: { track_mode: input.mode,
      value: rewardNumber(input.value, input.mode), unit_yen: input.mode === "count" && input.unit.trim() ? rewardNumber(input.unit, "amount") : null }, note: reason };
  }
  const value = rewardNumber(input.value, reward.track_mode, kind !== "adjust");
  if (kind === "consume" && value > reward.remaining_value) throw new Error("残高を超えて使うことはできません。");
  if (kind === "adjust") return { ...base, command_type: "adjust_reward_balance", payload: { value }, note: reason };
  return { ...base, command_type: kind === "consume" ? "consume_reward" : "restock_reward", payload: { value }, ...(reason ? { note: reason } : {}) };
}
export function archiveReward(reward: Reward): CommandDraft {
  return { command_type: "set_reward_archived", target: { id: reward.id }, expected_revision: reward.revision, payload: { archived: !reward.archived_at } };
}
export function rewardUnit(mode: TrackMode) { return mode === "count" ? "枚" : "円"; }
export function rewardAmount(value: number) { return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 }); }
