"use client";
import { useState } from "react";
import type { CommandDraft, Workspace } from "@/lib/yutai/contracts";
import { rewardFields, rewardNumber, saveReward } from "@/lib/yutai/rewards";
import CameraScanButton from "./components/CameraScanButton";
import type { ScanResult } from "./scan-utils";

export function DatabaseScan({ snapshot, onSave }: { snapshot: Workspace; onSave: (command: CommandDraft) => void }) {
  const [draft, setDraft] = useState<ScanResult | null>(null);
  const [captured, setCaptured] = useState(snapshot);
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const accept = (result: ScanResult) => { setCaptured(snapshot); setDraft(result); setTarget(""); setError(""); };
  return <section aria-label="DB画像スキャン">
    <CameraScanButton mode="camera" onResult={accept} onError={setError} />
    <CameraScanButton mode="gallery" onResult={accept} onError={setError} />
    {draft && <form onSubmit={event => { event.preventDefault(); setError(""); try {
      const quantity = rewardNumber(String(draft.quantity ?? ""), "count", true);
      const fields = { ...rewardFields(), title: draft.title ?? "", company: draft.company ?? "", expires_on: draft.expiresOn,
        unit_yen: draft.amountYen === null ? null : rewardNumber(String(draft.amountYen), "amount") };
      const validated = saveReward(captured, null, fields, { mode: "count", initial: String(quantity), profileId: null, cycleId: null })!;
      const existing = captured.rewards.find(r => r.id === target);
      if (target && (!existing || existing.archived_at || existing.track_mode !== "count")) throw new Error("統合対象を選び直してください。");
      if (existing && (existing.expires_on !== fields.expires_on || existing.unit_yen !== fields.unit_yen)) throw new Error("期限・額面が異なる優待には統合できません。別の優待として追加してください。");
      if (!window.confirm(existing ? `${existing.title}へ${quantity}枚を補充します。既存メモと履歴は残ります。` : `${fields.title}を${quantity}枚で新規登録します。既存の優待は変更しません。`)) return;
      onSave(existing ? { command_type: "restock_reward", target: { id: existing.id }, expected_revision: existing.revision,
        payload: { value: quantity }, note: "画像スキャン結果を確認して補充" } : validated);
      setDraft(null);
    } catch (cause) { setError((cause as Error).message); } }}>
      <p>読取結果を確認・修正してください。自動保存はしません。額面は1枚分です。</p>
      <label>読取優待名<input value={draft.title ?? ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>読取企業名<input value={draft.company ?? ""} onChange={e => setDraft({ ...draft, company: e.target.value })} /></label>
      <label>読取期限<input type="date" value={draft.expiresOn ?? ""} onChange={e => setDraft({ ...draft, expiresOn: e.target.value || null })} /></label>
      <label>読取枚数<input type="number" min="1" step="1" value={draft.quantity ?? ""} onChange={e => setDraft({ ...draft, quantity: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      <label>読取額面<input type="number" min="0" step="0.01" value={draft.amountYen ?? ""} onChange={e => setDraft({ ...draft, amountYen: e.target.value === "" ? null : Number(e.target.value) })} /></label>
      <label>保存方法<select value={target} onChange={e => setTarget(e.target.value)}><option value="">別の優待として追加</option>
        {captured.rewards.filter(r => !r.archived_at && r.track_mode === "count").map(r => <option key={r.id} value={r.id}>{r.title} / {r.company} / {r.expires_on ?? "期限なし"}に補充</option>)}
      </select></label>
      <button type="submit">読取結果を確認して保存</button><button type="button" onClick={() => setDraft(null)}>読取結果を破棄</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
