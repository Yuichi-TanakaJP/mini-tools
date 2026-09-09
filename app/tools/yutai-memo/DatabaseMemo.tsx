"use client";

import { useEffect, useState } from "react";
import { useYutaiWorkspace } from "@/lib/yutai/browser";
import { isSyncConfigured } from "@/lib/supabase/config";
import { useCalendarConnection, YutaiConnectionStatus } from "@/lib/yutai/calendar-connection";
import type { ViewState } from "@/lib/yutai/repository";
import type { CommandDraft, MonthState, Profile } from "@/lib/yutai/contracts";
import { monthDraft, optionalNumber, profileDraft, saveMonth, saveProfile, setProfileActive } from "@/lib/yutai/memo";
import { CROSS_TYPES } from "./types";
import styles from "./DatabaseMemo.module.css";

// Workspace RPC returns all profile/month/cycle rows; month 1 is only the selection-view argument.
export default function DatabaseMemo() {
  const configured = isSyncConfigured();
  const view = useYutaiWorkspace(1, configured);
  if (!configured) return <main className={styles.page}><p role="alert">DB接続設定がありません。従来保存へは戻しません。</p></main>;
  if (!view.data) return <main className={styles.page}><h1>優待銘柄メモ帳</h1>
    <p>{view.status === "signed_out" ? "Supabaseへのログインが必要です。" : "優待メモを取得しています。"}</p>
    {view.error && <p role="alert">取得に失敗しました。通信とログイン状態を確認してください。</p>}
    <a href="/account">ログイン画面へ</a> <button onClick={() => window.location.reload()}>再読み込み</button></main>;
  return <ConnectedMemo key={view.sessionRevision} view={view} />;
}
function ConnectedMemo({ view }: { view: ViewState }) {
  const connection = useCalendarConnection(view, new Date().getFullYear(), 1);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editor, setEditor] = useState<{ profile: Profile | null } | null>(null);
  const [monthEditor, setMonthEditor] = useState<{ profile: Profile; month: number; original: MonthState | null } | null>(null);
  const [notice, setNotice] = useState("");
  const data = view.data!;
  useEffect(() => {
    if (connection.action.status !== "saved" && connection.action.status !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close revision-bound drafts after external command completion
    setEditor(null); setMonthEditor(null);
  }, [connection.action.status]);
  const run = (command: CommandDraft | null) => {
    if (!command) { setEditor(null); setMonthEditor(null); setNotice("変更はありません。"); return; }
    setNotice(""); void connection.save([() => command]);
  };
  const profiles = data.profiles.filter(p => (showInactive || p.active) && `${p.stock_code} ${p.display_name} ${p.memo}`.toLowerCase().includes(query.toLowerCase()));
  return <main className={styles.page}>
    <h1>優待銘柄メモ帳</h1>
    <YutaiConnectionStatus connection={connection} scope="メモ帳の基本編集" />
    <p>月別の株数・優待価値を含めDBへ保存します。タグと全年度の仕込み履歴は表示のみです。
      一括操作・履歴編集・入出力・通知は未接続です。本番切替は未完了です。</p>
    {notice && <p role="status">{notice}</p>}
    <fieldset className={styles.panel} disabled={connection.blocked || view.stale}>
      <div className={styles.row}><label>検索<input value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />非表示も表示</label>
        <button onClick={() => { setEditor({ profile: null }); setMonthEditor(null); }}>銘柄を追加</button></div>
      <p>{profiles.length}銘柄</p>
      {profiles.map(profile => <article className={styles.card} key={profile.id}>
        <h2>{profile.stock_code} {profile.display_name}{!profile.active && "（非表示）"}</h2>
        <p>{profile.cross_strategy} / {"★".repeat(profile.priority)}</p>
        <p className={styles.memo}>{profile.memo || "メモ未設定"}</p>
        <p>1株開始: {profile.one_share_started_on ?? profile.one_share_started_legacy_text ?? "未設定"}</p>
        <p>タグ: {data.profile_tags.filter(t => t.profile_id === profile.id).map(t => data.tags.find(tag => tag.id === t.tag_id)?.name ?? "名称不明").join("、") || "なし"}</p>
        <div className={styles.row}><button onClick={() => { setEditor({ profile }); setMonthEditor(null); }}>メモ編集</button>
          <button onClick={() => {
            if (window.confirm(`${profile.display_name}を${profile.active ? "非表示" : "再表示"}にします。月別設定・メモ・仕込み履歴・残高は削除しません。`)) run(setProfileActive(profile, !profile.active));
          }}>{profile.active ? "非表示にする" : "再表示する"}</button></div>
        <div className={styles.row}>{Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
          const state = data.month_states.find(s => s.profile_id === profile.id && s.entitlement_month === month);
          return <button key={month} disabled={!profile.active} onClick={() => { setMonthEditor({ profile, month, original: state ?? null }); setEditor(null); }}>
            {month}月{state ? `：${state.required_shares ?? "未設定"}株 / ${state.benefit_value_yen ?? "未設定"}円` : "を追加"}</button>;
        })}</div>
        <details><summary>全年度の仕込み履歴（{data.cycles.filter(c => c.profile_id === profile.id).length}件）</summary>
          {data.cycles.filter(c => c.profile_id === profile.id).map(c => <p key={c.id}>{c.entitlement_year}年{c.entitlement_month}月 / {c.status} / {c.prepared_at ?? "仕込み日未設定"} / {c.note}</p>)}
        </details>
      </article>)}
      {editor && <ProfileEditor key={editor.profile?.id ?? "new"} original={editor.profile} onSave={run} onCancel={() => setEditor(null)} />}
      {monthEditor && <MonthEditor key={`${monthEditor.profile.id}:${monthEditor.month}`} {...monthEditor} onSave={run} onCancel={() => setMonthEditor(null)} />}
    </fieldset>
  </main>;
}
function ProfileEditor({ original, onSave, onCancel }: { original: Profile | null; onSave: (c: CommandDraft | null) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => profileDraft(original ?? undefined));
  const [code, setCode] = useState(original?.stock_code ?? "");
  const [error, setError] = useState("");
  return <section role="dialog" aria-label="銘柄メモ編集" className={styles.editor}>
    <h2>{original ? "メモ編集" : "銘柄追加"}</h2>
    <form onSubmit={e => { e.preventDefault(); try { onSave(saveProfile(original, code, draft)); } catch (e) { setError((e as Error).message); } }}>
      <label>銘柄コード<input autoFocus value={code} readOnly={Boolean(original)} onChange={e => setCode(e.target.value.toUpperCase())} /></label>
      <label>銘柄名<input value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} /></label>
      <label>方針<select value={draft.cross_strategy} onChange={e => setDraft({ ...draft, cross_strategy: e.target.value as typeof draft.cross_strategy })}>
        {["未設定", ...CROSS_TYPES].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>優先度<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) as 1 | 2 | 3 })}>
        {[1, 2, 3].map(n => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></label>
      <label>メモ<textarea value={draft.memo} onChange={e => setDraft({ ...draft, memo: e.target.value })} /></label>
      <label>早打ち目安<input value={draft.entry_timing ?? ""} onChange={e => setDraft({ ...draft, entry_timing: e.target.value || null })} /></label>
      <label>長期条件<input value={draft.tenure_rule ?? ""} onChange={e => setDraft({ ...draft, tenure_rule: e.target.value || null })} /></label>
      <label>関連URL<input value={draft.related_url ?? ""} onChange={e => setDraft({ ...draft, related_url: e.target.value || null })} /></label>
      <label>公式URL<input value={draft.official_benefit_url ?? ""} onChange={e => setDraft({ ...draft, official_benefit_url: e.target.value || null })} /></label>
      <label>1株保有開始日<input type="date" value={draft.one_share_started_on ?? ""} onChange={e => setDraft({ ...draft, one_share_started_on: e.target.value || null })} /></label>
      {original?.one_share_started_legacy_text && <p>旧記録（保持）: {original.one_share_started_legacy_text}。日付は推測せず、判明した場合だけ入力してください。</p>}
      <p>仕込み開始・株数・優待価値は各月のボタンから編集します。</p>
      {error && <p role="alert">{error}</p>}<button type="submit">保存</button> <button type="button" onClick={onCancel}>閉じる</button>
    </form>
  </section>;
}
function MonthEditor({ profile, month, original, onSave, onCancel }: { profile: Profile; month: number; original: MonthState | null;
  onSave: (c: CommandDraft | null) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => monthDraft(original ?? undefined));
  const [shares, setShares] = useState(String(original?.required_shares ?? ""));
  const [value, setValue] = useState(String(original?.benefit_value_yen ?? ""));
  const [lead, setLead] = useState(String(original?.preparation_months_before ?? ""));
  const [error, setError] = useState("");
  return <section role="dialog" aria-label="月別設定編集" className={styles.editor}><h2>{profile.display_name} {month}月</h2>
    <form onSubmit={e => { e.preventDefault(); try { onSave(saveMonth(original, profile.id, month, { ...draft,
      required_shares: optionalNumber(shares, "株数"), benefit_value_yen: optionalNumber(value, "優待価値"),
      preparation_months_before: optionalNumber(lead, "仕込み開始", true) })); } catch (e) { setError((e as Error).message); } }}>
      <label>株数<input autoFocus inputMode="decimal" value={shares} onChange={e => setShares(e.target.value)} /></label>
      <label>優待価値（円）<input inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /></label>
      <label>仕込み開始（何か月前）<input inputMode="numeric" value={lead} onChange={e => setLead(e.target.value)} /></label>
      <p>空欄は未設定。仕込み開始の0は権利月です。他の月には反映しません。</p>
      <label><input type="checkbox" checked={draft.long_term_required} onChange={e => setDraft({ ...draft, long_term_required: e.target.checked })} />長期必須</label>
      <label><input type="checkbox" checked={draft.long_term_benefit} onChange={e => setDraft({ ...draft, long_term_benefit: e.target.checked })} />長期優待あり</label>
      <label>月別メモ<textarea value={draft.month_memo} onChange={e => setDraft({ ...draft, month_memo: e.target.value })} /></label>
      {error && <p role="alert">{error}</p>}<button type="submit">月別設定を保存</button> <button type="button" onClick={onCancel}>閉じる</button>
    </form></section>;
}
