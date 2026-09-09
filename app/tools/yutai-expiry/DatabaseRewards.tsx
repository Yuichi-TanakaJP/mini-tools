"use client";
import { useEffect, useState } from "react";
import { useYutaiWorkspace } from "@/lib/yutai/browser";
import { isSyncConfigured } from "@/lib/supabase/config";
import { useCalendarConnection, YutaiConnectionStatus } from "@/lib/yutai/calendar-connection";
import type { ViewState } from "@/lib/yutai/repository";
import type { CommandDraft, Reward, TrackMode, Workspace } from "@/lib/yutai/contracts";
import { archiveReward, rewardAction, rewardActions, rewardAmount, rewardFields, rewardNumber, rewardUnit, saveReward, type RewardAction } from "@/lib/yutai/rewards";
import styles from "../yutai-memo/DatabaseMemo.module.css";

export default function DatabaseRewards() {
  const configured = isSyncConfigured();
  const view = useYutaiWorkspace(1, configured);
  if (!configured) return <section className={styles.page}><p role="alert">DB接続設定がありません。従来保存へは戻しません。</p></section>;
  if (!view.data) return <section className={styles.page}><h1>株主優待期限帳</h1>
    <p>{view.status === "signed_out" ? "Supabaseへのログインが必要です。" : "優待残高を取得しています。"}</p>
    {view.error && <p role="alert">取得に失敗しました。通信とログイン状態を確認してください。</p>}
    <a href="/account">ログイン画面へ</a> <button onClick={() => window.location.reload()}>再読み込み</button></section>;
  return <ConnectedRewards key={view.sessionRevision} view={view} />;
}
type Edit = { snapshot: Workspace; reward: Reward | null };
type Action = { snapshot: Workspace; reward: Reward; kind: RewardAction; eventId?: string };
function ConnectedRewards({ view }: { view: ViewState }) {
  const connection = useCalendarConnection(view, new Date().getFullYear(), 1);
  const [editor, setEditor] = useState<Edit | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [query, setQuery] = useState("");
  const [archives, setArchives] = useState(false);
  const [completed, setCompleted] = useState(true);
  const [month, setMonth] = useState("");
  const [notice, setNotice] = useState("");
  const data = view.data!;
  useEffect(() => {
    if (!["saved", "idle"].includes(connection.action.status)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close captured drafts after the shared command completes
    setEditor(null); setAction(null);
  }, [connection.action.status]);
  const run = (command: CommandDraft | null) => {
    if (!command) { setEditor(null); setAction(null); setNotice("変更はありません。"); return; }
    setNotice(""); void connection.save([() => command]);
  };
  const openAction = (reward: Reward, kind: RewardAction, eventId?: string) => { setEditor(null); setAction({ snapshot: data, reward, kind, eventId }); };
  const rewards = data.rewards.filter(r => (archives || !r.archived_at) && (completed || r.remaining_value > 0) &&
    (!month || r.expires_on?.startsWith(month)) && `${r.title} ${r.company} ${r.memo}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.title.localeCompare(b.title, "ja"));
  return <section className={styles.page}>
    <h1>株主優待期限帳</h1><YutaiConnectionStatus connection={connection} scope="残高・期限" />
    {process.env.NEXT_PUBLIC_YUTAI_TRANSFER_DB_PREVIEW === "true" && <p><a href="/tools/data-transfer">優待DBの全件出力・照合</a></p>}
    <p>DBの残高と利用履歴を表示・更新します。画像スキャン・一括取り込み/復元実行・ホーム通知は未接続です。本番切替は未完了です。</p>
    {notice && <p role="status">{notice}</p>}
    <fieldset className={styles.panel} disabled={connection.blocked || view.stale}>
      <div className={styles.row}>
        <label>検索<input value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>期限月<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
        <button onClick={() => setMonth("")}>全期限を表示</button>
        <label><input type="checkbox" checked={archives} onChange={e => setArchives(e.target.checked)} />アーカイブを含む</label>
        <label><input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />使用済みを含む</label>
        <button onClick={() => { setAction(null); setEditor({ snapshot: data, reward: null }); }}>優待を追加</button>
      </div><p>{rewards.length}件</p>
      {rewards.map(reward => <article key={reward.id} className={styles.card} aria-label={reward.title}>
        <h2>{reward.title}{reward.archived_at && "（アーカイブ済み）"}</h2>
        <p>{reward.company} / 期限: {reward.expires_on ?? "未設定"}</p>
        <p>残高: {rewardAmount(reward.remaining_value)}{rewardUnit(reward.track_mode)} / 初期: {rewardAmount(reward.initial_value)}{rewardUnit(reward.track_mode)}</p>
        {reward.track_mode === "count" && <p>1枚の額面: {reward.unit_yen === null ? "未設定" : `${rewardAmount(reward.unit_yen)}円`}</p>}
        <p className={styles.memo}>{reward.memo}</p>
        {reward.link && (/^https?:\/\//i.test(reward.link) ? <a href={reward.link} target="_blank" rel="noopener noreferrer">関連URL</a> : <p>関連URL（原文）: {reward.link}</p>)}
        {reward.profile_id && <p>銘柄: {data.profiles.find(p => p.id === reward.profile_id)?.display_name ?? "名称未設定"} / 仕込み履歴: {reward.cycle_id ? (() => { const c = data.cycles.find(c => c.id === reward.cycle_id); return c ? `${c.entitlement_year}年${c.entitlement_month}月` : "参照不明"; })() : "未設定"}</p>}
        <div className={styles.row}>
          <button onClick={() => { setAction(null); setEditor({ snapshot: data, reward }); }}>優待を編集</button>
          {(["consume", "restock", "adjust", "mode"] as const).map(kind => <button key={kind} disabled={Boolean(reward.archived_at)} onClick={() => openAction(reward, kind)}>{rewardActions[kind]}</button>)}
          <button onClick={() => { if (window.confirm(`${reward.title}を${reward.archived_at ? "アーカイブ解除" : "アーカイブ"}します。残高と利用履歴は残ります。`)) run(archiveReward(reward)); }}>{reward.archived_at ? "アーカイブ解除" : "アーカイブ"}</button>
          <button onClick={() => openAction(reward, "delete")}>優待を削除</button>
        </div>
        <details><summary>利用履歴（{data.reward_events.filter(e => e.reward_id === reward.id).length}件）</summary>
          {data.reward_events.filter(e => e.reward_id === reward.id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).map(event => <div key={event.id}>
            <p>{new Date(event.occurred_at).toLocaleString("ja-JP")} / {event.event_type} / {rewardAmount(event.delta_value)}{rewardUnit(event.track_mode)} / {event.note}</p>
            <button disabled={Boolean(reward.archived_at)} onClick={() => openAction(reward, "remove", event.id)}>この履歴を取り消す</button>
          </div>)}
        </details>
      </article>)}
      {editor && <RewardEditor key={editor.reward ? `${editor.reward.id}:${editor.reward.revision}` : "new"} {...editor} onSave={run} onClose={() => setEditor(null)} />}
      {action && <RewardOperation key={`${action.reward.id}:${action.reward.revision}:${action.kind}:${action.eventId ?? ""}`} {...action} onSave={run} onClose={() => setAction(null)} />}
    </fieldset>
  </section>;
}
type FormCallbacks = { onSave: (command: CommandDraft | null) => void; onClose: () => void };
function RewardEditor({ snapshot, reward, onSave, onClose }: Edit & FormCallbacks) {
  const [fields, setFields] = useState(() => rewardFields(reward ?? undefined));
  const [mode, setMode] = useState<TrackMode>(reward?.track_mode ?? "count");
  const [initial, setInitial] = useState("");
  const [unit, setUnit] = useState(String(reward?.unit_yen ?? ""));
  const [profileId, setProfileId] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  return <section role="dialog" aria-label="優待編集" className={styles.editor}><h2>{reward ? "優待編集" : "優待追加"}</h2>
    <form onSubmit={e => { e.preventDefault(); setError(""); try {
      onSave(saveReward(snapshot, reward, { ...fields, unit_yen: mode === "count" && unit.trim() ? rewardNumber(unit, "amount") : null }, { mode, initial, profileId, cycleId }));
    } catch (e) { setError((e as Error).message); } }}>
      <label>優待名<input autoFocus value={fields.title} onChange={e => setFields({ ...fields, title: e.target.value })} /></label>
      <label>企業名<input value={fields.company} onChange={e => setFields({ ...fields, company: e.target.value })} /></label>
      <label>期限日<input type="date" value={fields.expires_on ?? ""} onChange={e => setFields({ ...fields, expires_on: e.target.value || null })} /></label>
      {!reward && <>
        <label>管理単位<select aria-label="管理単位" value={mode} onChange={e => setMode(e.target.value as TrackMode)}><option value="count">枚数</option><option value="amount">金額</option></select></label>
        <label>初期残高（{rewardUnit(mode)}）<input aria-label="初期残高" inputMode="decimal" value={initial} onChange={e => setInitial(e.target.value)} /></label>
        <label>銘柄との紐付け<select aria-label="銘柄との紐付け" value={profileId ?? ""} onChange={e => { setProfileId(e.target.value || null); setCycleId(null); }}><option value="">なし</option>{snapshot.profiles.map(p => <option key={p.id} value={p.id}>{p.stock_code} {p.display_name}</option>)}</select></label>
        <label>仕込み履歴との紐付け<select aria-label="仕込み履歴との紐付け" value={cycleId ?? ""} onChange={e => setCycleId(e.target.value || null)}><option value="">なし</option>{snapshot.cycles.filter(c => c.profile_id === profileId).map(c => <option key={c.id} value={c.id}>{c.entitlement_year}年{c.entitlement_month}月</option>)}</select></label>
      </>}
      {mode === "count" && <label>1枚の額面（円・空欄は未設定）<input aria-label="1枚の額面" inputMode="decimal" value={unit} onChange={e => setUnit(e.target.value)} /></label>}
      <label>優待メモ<textarea value={fields.memo} onChange={e => setFields({ ...fields, memo: e.target.value })} /></label>
      <label>関連URL<input value={fields.link ?? ""} onChange={e => setFields({ ...fields, link: e.target.value || null })} /></label>
      {reward && <p>残高・初期値・管理単位・紐付けはこの編集では変更しません。残高操作は一覧の専用ボタンから行ってください。</p>}
      {error && <p role="alert">{error}</p>}<button type="submit">優待を保存</button> <button type="button" onClick={onClose}>閉じる</button>
    </form></section>;
}
function RewardOperation({ snapshot, reward, kind, eventId, onSave, onClose }: Action & FormCallbacks) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<TrackMode>(reward.track_mode === "count" ? "amount" : "count");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const count = snapshot.reward_events.filter(e => e.reward_id === reward.id).length;
  const selectedEvent = snapshot.reward_events.find(e => e.id === eventId && e.reward_id === reward.id);
  const warning = kind === "delete" ? `この優待と利用履歴${count}件を現在の一覧から削除します。元の内容はDB監査に残り、銘柄メモ・仕込み履歴・他の優待は残ります。` :
    kind === "mode" ? `初期値と残高を新しい単位の入力値に設定し、旧利用履歴${count}件は現在の一覧から除きDB監査へ残します。自動換算はしません。` :
    kind === "remove" ? "選択した履歴1件を取り消し、DBで残高を再計算します。元の履歴はDB監査に残ります。" :
    kind === "adjust" ? "入力値を訂正後残高として保存し、差額と理由を利用履歴に残します。" : "入力した量だけ残高を変更し、利用履歴と同時に保存します。";
  return <section role="dialog" aria-label="残高操作" className={styles.editor}>
    <h2>{reward.title}：{rewardActions[kind]}</h2><p>{warning}</p>
    {selectedEvent && <p>取消対象: {selectedEvent.occurred_at} / {selectedEvent.event_type} / {rewardAmount(selectedEvent.delta_value)}{rewardUnit(selectedEvent.track_mode)} / {selectedEvent.note}</p>}
    <form onSubmit={e => { e.preventDefault(); setError(""); try {
      const command = rewardAction(snapshot, reward, kind, { value, reason, mode, unit, eventId });
      if (["delete", "mode", "remove", "adjust"].includes(kind) && !window.confirm(`${reward.title}: ${warning}`)) return;
      onSave(command);
    } catch (e) { setError((e as Error).message); } }}>
      {kind === "mode" && <label>変更後の管理単位<select aria-label="変更後の管理単位" value={mode} onChange={e => setMode(e.target.value as TrackMode)}><option value="count">枚数</option><option value="amount">金額</option></select></label>}
      {!["delete", "remove"].includes(kind) && <label>{kind === "adjust" || kind === "mode" ? "変更後残高" : "利用・補充量"}（{rewardUnit(kind === "mode" ? mode : reward.track_mode)}）<input aria-label="操作する値" autoFocus inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /></label>}
      {kind === "mode" && mode === "count" && <label>1枚の額面<input aria-label="変更後の額面" inputMode="decimal" value={unit} onChange={e => setUnit(e.target.value)} /></label>}
      <label>理由・利用メモ<input value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}<button type="submit">操作を保存</button> <button type="button" onClick={onClose}>閉じる</button>
    </form></section>;
}
