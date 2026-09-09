"use client";
import { useState } from "react";
import type { CommandDraft, Cycle, Workspace } from "@/lib/yutai/contracts";
import { cycleDates, cycleDraft, cycleStatuses, deleteCycle, localTimestamp, saveCycle, timestampValue } from "@/lib/yutai/cycles";
import styles from "./DatabaseMemo.module.css";

export function DatabaseCycles({ snapshot, profileId, original, onSave, onClose }: {
  snapshot: Workspace; profileId: string; original: Cycle | null;
  onSave: (command: CommandDraft | null) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => cycleDraft(original ?? undefined));
  const [quantity, setQuantity] = useState(String(original?.quantity ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const profile = snapshot.profiles.find(p => p.id === profileId)!;
  return <section role="dialog" aria-label="仕込み履歴編集" className={styles.editor}>
    <h2>{profile.display_name}：{original ? "履歴編集" : "履歴追加"}</h2>
    <form onSubmit={e => { e.preventDefault(); try {
      onSave(saveCycle(snapshot, profileId, original, { ...draft, quantity: quantity.trim() ? Number(quantity) : null }));
    } catch (e) { setError((e as Error).message); } }}>
      <label>権利年<input autoFocus type="number" min="1" max="9999" required value={draft.entitlement_year || ""} onChange={e => setDraft({ ...draft, entitlement_year: Number(e.target.value) })} /></label>
      <label>権利月<select aria-label="権利月" required value={draft.entitlement_month || ""} onChange={e => setDraft({ ...draft, entitlement_month: Number(e.target.value) })}>
        <option value="">選択してください</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}月</option>)}
      </select></label>
      <label>履歴の状態<select aria-label="履歴の状態" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}>
        {Object.entries(cycleStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <p>権利が発生する年・月を指定します。日時は端末の時間帯（{Intl.DateTimeFormat().resolvedOptions().timeZone}）です。状態変更だけでは日時を自動補完・消去しません。</p>
      {(Object.entries(cycleDates) as [keyof typeof cycleDates, string][]).map(([field, label]) => <label key={field}>{label}
        <input type="datetime-local" step="0.001" value={localTimestamp(draft[field])} onChange={e => {
          try { setDraft({ ...draft, [field]: timestampValue(e.target.value, draft[field]) }); } catch (e) { setError((e as Error).message); }
        }} /></label>)}
      <label>仕込み株数<input inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label>口座名<input value={draft.account_label ?? ""} onChange={e => setDraft({ ...draft, account_label: e.target.value || null })} /></label>
      <label>履歴メモ<textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
      <p>この履歴だけを保存します。他の権利年月・月別設定・銘柄メモ・優待残高は変更しません。</p>
      {error && <p role="alert">{error}</p>}
      <button type="submit">履歴を保存</button> <button type="button" onClick={onClose}>閉じる</button>
    </form>
    {original && <details><summary>この履歴を削除</summary>
      <p>優待残高に紐付いた履歴は削除できません。削除前の内容はDB監査に残ります。</p>
      <label>削除理由<input value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button type="button" onClick={() => { try {
        const command = deleteCycle(snapshot, original, reason);
        if (window.confirm(`${profile.display_name}の${original.entitlement_year}年${original.entitlement_month}月の履歴1件を削除します。他の履歴・月別設定・メモ・優待残高は残ります。元の内容はDB監査に残ります。`)) onSave(command);
      } catch (e) { setError((e as Error).message); } }}>履歴を削除</button>
    </details>}
  </section>;
}
