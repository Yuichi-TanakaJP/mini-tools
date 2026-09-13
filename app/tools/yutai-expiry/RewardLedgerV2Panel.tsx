"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useYutaiRewardLedgerV2 } from "../../../lib/yutai/reward-v2-browser";
import type { RewardV2Account, RewardV2BenefitKind, RewardV2Coverage, RewardV2Entitlement } from "../../../lib/yutai/reward-v2-contracts";
import styles from "./RewardLedgerV2Panel.module.css";

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function valueText(value: number, unit: string) {
  if (unit === "yen") return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  if (unit === "point") return `${value.toLocaleString("ja-JP")} pt`;
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}
function coverageLabel(value: string) { return value === "native_complete" ? "追跡完全" : "履歴一部"; }

export function RewardLedgerV2Panel() {
  const [today] = useState(localDate);
  const { state, repository } = useYutaiRewardLedgerV2(today);
  const [accountTitle,setAccountTitle] = useState("");
  const [accountKind,setAccountKind] = useState<RewardV2BenefitKind>("stored_value");
  const [accountUnit,setAccountUnit] = useState("yen");
  const [expiryPolicy,setExpiryPolicy] = useState("none");
  const [rollingMonths,setRollingMonths] = useState("12");
  const [allocationPolicy,setAllocationPolicy] = useState("fifo");
  const [linkTargets,setLinkTargets] = useState<Record<string,string>>({});
  const busy = state.status === "saving" || state.status === "loading";
  const ledger = state.ledger;

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!repository || !accountTitle.trim()) return;
    const key = `custom-${Date.now().toString(36)}`;
    const payload: Record<string, unknown> = { account_key:key, title:accountTitle.trim(), benefit_kind:accountKind, native_unit:accountUnit.trim() || "count", expiry_policy:expiryPolicy, allocation_policy:allocationPolicy };
    if (expiryPolicy === "rolling_inactivity") payload.rolling_expiry_months = Number(rollingMonths);
    const result = await repository.save({ command_type:"create_account", target:{}, payload, expected_revision:0, note:"MiniTools: Reward Model v2 Account作成" });
    if (result) setAccountTitle("");
  }
  async function linkLegacy(rewardId: string, revision: number, coverageState: RewardV2Coverage) {
    if (!repository) return;
    const accountId = linkTargets[rewardId];
    if (!accountId) return;
    await repository.save({ command_type:"link_legacy_reward", target:{id:rewardId}, payload:{account_id:accountId,coverage_state:coverageState}, expected_revision:revision, note:"MiniTools: legacy Rewardをv2 Accountへ紐付け（coverageは推測せず維持）" });
  }

  if (state.status === "signed_out" || !state.ownerId) return null;
  return <section className={styles.panel} aria-labelledby="reward-v2-title">
    <div className={styles.header}>
      <div><h3 id="reward-v2-title">高度な残高・期限管理 v2</h3><p>Account合計と期限別Lot、申込・利用期限を分けて管理します。旧期限帳データは自動変換しません。</p></div>
      <div className={styles.badges}>
        <span className={styles.badge}>Account {ledger?.counts.accounts ?? 0}</span>
        <span className={styles.badge}>権利 {ledger?.counts.entitlements ?? 0}</span>
        <span className={styles.badge}>未割当 {ledger?.counts.unassigned_rewards ?? 0}</span>
      </div>
    </div>
    {state.error && <div className={styles.error}>v2取得/保存エラー: {state.error}{state.uncertain && repository && <div className={styles.actions}><button type="button" onClick={() => void repository.retryUncertain()}>同じrequest_idで再確認</button></div>}</div>}
    {state.status === "loading" && !ledger && <p>v2台帳を読み込み中…</p>}
    {ledger && ledger.counts.accounts===0 && <div className={styles.warning}>まだv2 Accountはありません。既存の優待はそのまま維持されています。必要なものだけ下の「未割当Reward」から段階的に紐付けます。</div>}

    <form className={styles.form} onSubmit={createAccount}>
      <strong>新しいAccountを作る</strong>
      <div className={styles.inline}>
        <label>名称<input value={accountTitle} onChange={e=>setAccountTitle(e.target.value)} placeholder="例: QUOカード" required /></label>
        <label>種類<select value={accountKind} onChange={e=>setAccountKind(e.target.value as RewardV2BenefitKind)}><option value="stored_value">金額残高</option><option value="points">ポイント</option><option value="voucher">券</option><option value="admission">入場</option><option value="discount">割引</option><option value="service_access">サービス権</option><option value="service_period">サービス期間</option><option value="choice">選択型</option><option value="goods">現物</option><option value="cashback">還元</option><option value="composite">複合</option><option value="other">その他</option></select></label>
        <label>単位<input value={accountUnit} onChange={e=>setAccountUnit(e.target.value)} placeholder="yen / point / count" /></label>
      </div>
      <div className={styles.inline}>
        <label>期限<select value={expiryPolicy} onChange={e=>setExpiryPolicy(e.target.value)}><option value="none">なし</option><option value="fixed_per_grant">付与Lotごと</option><option value="rolling_inactivity">最終活動から更新</option><option value="external_managed">外部管理</option></select></label>
        {expiryPolicy === "rolling_inactivity" && <label>更新月数<input type="number" min="1" value={rollingMonths} onChange={e=>setRollingMonths(e.target.value)} /></label>}
        <label>消費順<select value={allocationPolicy} onChange={e=>setAllocationPolicy(e.target.value)}><option value="fifo">取得順</option><option value="fefo">期限が近い順</option><option value="manual">Lot指定</option><option value="not_applicable">残高消費なし</option></select></label>
        <button type="submit" disabled={busy}>作成</button>
      </div>
    </form>

    {ledger && <>
      <div className={styles.grid}>{ledger.accounts.map(account => <AccountCard key={account.id} account={account} repository={repository} busy={busy} today={today} />)}</div>
      {ledger.entitlements.length>0 && <div className={styles.section}><h4>権利・申込期限</h4><div className={styles.grid}>{ledger.entitlements.map(e=><EntitlementCard key={e.id} entitlement={e} repository={repository} busy={busy} />)}</div></div>}
      {ledger.unassigned_rewards.length>0 && <div className={styles.section}><h4>未割当Reward（旧データ）</h4><p className={styles.muted}>残高・履歴は変更せず、Accountへの所属だけを追加します。過去の取得履歴や開始残高の意味は推測しません。</p><div className={styles.legacyList}>{ledger.unassigned_rewards.map(r=><div className={styles.card} key={r.id}><strong>{r.title}</strong> <span className={styles.muted}>{r.company}</span><div className={styles.muted}>現在 {valueText(r.remaining_value,r.track_mode === "amount" ? "yen" : "count")} / 期限 {r.expires_on ?? "なし"} / {coverageLabel(r.coverage_state)}</div>{ledger.accounts.length>0 && <div className={styles.inline}><label>紐付け先<select value={linkTargets[r.id] ?? ""} onChange={e=>setLinkTargets(v=>({...v,[r.id]:e.target.value}))}><option value="">選択</option>{ledger.accounts.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><button type="button" disabled={busy || !linkTargets[r.id]} onClick={()=>void linkLegacy(r.id,r.revision,r.coverage_state)}>残高を変えず紐付け</button></div>}</div>)}</div></div>}
    </>}
  </section>;
}

function AccountCard({account,repository,busy,today}:{account:RewardV2Account;repository:ReturnType<typeof useYutaiRewardLedgerV2>["repository"];busy:boolean;today:string}) {
  const [consume,setConsume] = useState("");
  const [grantValue,setGrantValue] = useState("");
  const [grantTitle,setGrantTitle] = useState("");
  const [grantExpiry,setGrantExpiry] = useState("");
  async function consumeAccount(e:FormEvent) { e.preventDefault(); if(!repository) return; const value=Number(consume); if(!(value>0)) return; const result=await repository.save({command_type:"consume_account",target:{id:account.id},payload:{value},expected_revision:account.revision,note:"MiniTools: Accountから使用"}); if(result)setConsume(""); }
  async function addGrant(e:FormEvent) { e.preventDefault(); if(!repository) return; const value=Number(grantValue); if(!(value>=0)||!grantTitle.trim()) return; const payload:Record<string,unknown>={title:grantTitle.trim(),track_mode:account.native_unit==="yen"?"amount":"count",initial_value:value}; if(grantExpiry)payload.expires_on=grantExpiry; const result=await repository.save({command_type:"create_grant",target:{id:account.id},payload,expected_revision:account.revision,note:"MiniTools: 新規Grant Lot追加"}); if(result){setGrantValue("");setGrantTitle("");setGrantExpiry("");} }
  async function expireAccount(){ if(!repository)return; await repository.save({command_type:"expire_account",target:{id:account.id},payload:{},expected_revision:account.revision,note:"MiniTools: rolling期限切れ残高を失効確定"}); }
  return <article className={styles.card}>
    <h4>{account.title}</h4><div className={styles.badges}><span className={styles.badge}>{account.benefit_kind}</span><span className={styles.badge}>{coverageLabel(account.coverage_state)}</span></div>
    <div className={styles.metrics}>
      <div className={styles.metric}><small>現在残高</small><strong>{valueText(account.recorded_balance_native,account.native_unit)}</strong></div>
      <div className={styles.metric}><small>利用可能</small><strong>{valueText(account.available_balance_native,account.native_unit)}</strong></div>
      <div className={styles.metric}><small>追跡開始時残高</small><strong>{valueText(account.opening_balance_native,account.native_unit)}</strong></div>
      <div className={styles.metric}><small>追跡後の取得</small><strong>{valueText(account.tracked_granted_native,account.native_unit)}</strong></div>
      <div className={styles.metric}><small>追跡後の利用</small><strong>{valueText(account.tracked_consumed_native,account.native_unit)}</strong></div>
      <div className={styles.metric}><small>失効済み</small><strong>{valueText(account.tracked_expired_native,account.native_unit)}</strong></div>
    </div>
    <div className={styles.muted}>次回期限: {account.nearest_expiry ?? "なし"}{account.expiry_policy==="rolling_inactivity" ? `（最終活動から${account.rolling_expiry_months ? `${account.rolling_expiry_months}か月` : `${account.rolling_expiry_days}日`}）` : ""}</div>
    {account.expired_unprocessed_native>0 && <div className={styles.warning}>期限切れ未処理: {valueText(account.expired_unprocessed_native,account.native_unit)}{account.expiry_policy==="rolling_inactivity" && <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void expireAccount()}>失効を確定</button></div>}</div>}
    {account.allocation_policy!=="manual" && account.allocation_policy!=="not_applicable" && <form className={styles.inline} onSubmit={consumeAccount}><label>使った量<input type="number" min="0" step={account.native_unit==="yen"?"0.01":"1"} value={consume} onChange={e=>setConsume(e.target.value)} /></label><button disabled={busy || !consume}>Accountから使用</button></form>}
    <details><summary>Grant Lot ({account.lots.length})</summary><ul className={styles.lots}>{account.lots.map(lot=><LotRow key={lot.id} lot={lot} account={account} repository={repository} busy={busy} today={today} />)}</ul></details>
    <details><summary>新しい付与を追加</summary><form className={styles.form} onSubmit={addGrant}><label>名称<input value={grantTitle} onChange={e=>setGrantTitle(e.target.value)} placeholder="例: 2026年9月付与" /></label><div className={styles.inline}><label>付与量<input type="number" min="0" step={account.native_unit==="yen"?"0.01":"1"} value={grantValue} onChange={e=>setGrantValue(e.target.value)} /></label><label>期限<input type="date" value={grantExpiry} onChange={e=>setGrantExpiry(e.target.value)} /></label><button disabled={busy}>追加</button></div></form></details>
  </article>;
}

function LotRow({lot,account,repository,busy,today}:{lot:RewardV2Account["lots"][number];account:RewardV2Account;repository:ReturnType<typeof useYutaiRewardLedgerV2>["repository"];busy:boolean;today:string}) {
  const [value,setValue]=useState("");
  const expired=Boolean(lot.expires_on && lot.expires_on<today && lot.remaining_value>0);
  async function consume(e:FormEvent){e.preventDefault();if(!repository)return;const n=Number(value);if(!(n>0))return;const r=await repository.save({command_type:"consume_lot",target:{id:lot.id},payload:{value:n},expected_revision:lot.revision,note:"MiniTools: Lot指定で使用"});if(r)setValue("");}
  async function expire(){if(!repository)return;await repository.save({command_type:"expire_lot",target:{id:lot.id},payload:{},expected_revision:lot.revision,note:"MiniTools: Lot期限切れを失効確定"});}
  return <li className={styles.lot}><strong>{lot.title}</strong><div className={styles.muted}>残 {valueText(lot.remaining_value,account.native_unit)} / 取得 {lot.granted_at?.slice(0,10) ?? "不明"} / 期限 {lot.expires_on ?? "なし"} / {coverageLabel(lot.coverage_state)}</div>{expired ? <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void expire()}>期限切れを確定</button></div> : account.allocation_policy==="manual" && lot.remaining_value>0 ? <form className={styles.inline} onSubmit={consume}><label>このLotから<input type="number" min="0" max={lot.remaining_value} step={lot.track_mode==="amount"?"0.01":"1"} value={value} onChange={e=>setValue(e.target.value)} /></label><button disabled={busy}>使用</button></form> : null}</li>;
}

function EntitlementCard({entitlement,repository,busy}:{entitlement:RewardV2Entitlement;repository:ReturnType<typeof useYutaiRewardLedgerV2>["repository"];busy:boolean}) {
  const [option,setOption]=useState(entitlement.selected_option ?? "");
  async function setStatus(status:RewardV2Entitlement["status"]){if(!repository)return;await repository.save({command_type:"set_entitlement_status",target:{id:entitlement.id},payload:{status},expected_revision:entitlement.revision,note:`MiniTools: Entitlementを${status}へ変更`});}
  async function saveOption(e:FormEvent){e.preventDefault();if(!repository||!option.trim())return;await repository.save({command_type:"select_entitlement_option",target:{id:entitlement.id},payload:{selected_option:option.trim()},expected_revision:entitlement.revision,note:"MiniTools: 優待選択肢を記録"});}
  async function completeDeadline(id:string,revision:number){if(!repository)return;await repository.save({command_type:"complete_deadline",target:{id},payload:{},expected_revision:revision,note:"MiniTools: 期限タスク完了"});}
  return <article className={styles.card}><h4>{entitlement.benefit_kind} / {entitlement.status}</h4><div className={styles.muted}>数量 {entitlement.native_quantity ?? "—"} {entitlement.native_unit ?? ""} / {coverageLabel(entitlement.coverage_state)}</div>{(["choice","composite","goods"] as string[]).includes(entitlement.benefit_kind) && <form className={styles.inline} onSubmit={saveOption}><label>選択内容<input value={option} onChange={e=>setOption(e.target.value)} /></label><button disabled={busy}>保存</button></form>}<div className={styles.actions}>{entitlement.status==="claim_required" && <button type="button" disabled={busy} onClick={()=>void setStatus("claimed")}>申込済みにする</button>}{entitlement.status==="claimed" && <button type="button" disabled={busy} onClick={()=>void setStatus("activated")}>有効化済み</button>}{["claimed","activated"].includes(entitlement.status) && <button type="button" disabled={busy} onClick={()=>void setStatus("fulfilled")}>受取/完了</button>}</div>{entitlement.deadlines.map(d=><div className={styles.deadline} key={d.id}><span>{d.deadline_type}: {d.due_on} {d.completed_at ? "✓" : ""}</span>{!d.completed_at && <button type="button" disabled={busy} onClick={()=>void completeDeadline(d.id,d.revision)}>完了</button>}</div>)}</article>;
}
