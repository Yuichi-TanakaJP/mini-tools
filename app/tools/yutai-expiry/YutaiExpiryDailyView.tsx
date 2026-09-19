"use client";

import { useEffect, useMemo, useState } from "react";
import { useYutaiRewardLedgerV2 } from "../../../lib/yutai/reward-v2-browser";
import { useYutaiScheduledGrants } from "../../../lib/yutai/scheduled-grants-browser";
import type { RewardV2Account, RewardV2BenefitKind, RewardV2DeadlineType, RewardV2Entitlement, RewardV2EntitlementStatus, RewardV2LegacyReward } from "../../../lib/yutai/reward-v2-contracts";
import type { YutaiScheduledGrantItem } from "../../../lib/yutai/scheduled-grants";
import styles from "./YutaiExpiryDashboard.module.css";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function num(v:number){ return v.toLocaleString("ja-JP",{maximumFractionDigits:2}); }
function shortDate(value:string){ const [,m,d]=value.split("-").map(Number); return `${m}/${d}`; }
function dateLabel(value:string,today:string){ const [y,m,d]=value.split("-").map(Number); return y===Number(today.slice(0,4))?`${m}月${d}日`:`${y}年${m}月${d}日`; }
function voucherUnitYen(account:RewardV2Account){
  const values=[...new Set(account.lots.filter(l=>!l.archived_at&&l.unit_yen!=null).map(l=>l.unit_yen as number))];
  return values.length===1?values[0]:null;
}
function accountValueText(account:RewardV2Account,value=account.available_balance_native){
  const n=num(value);
  if(account.native_unit==="yen") return `¥${n}`;
  if(["point","points","pt"].includes(account.native_unit)) return `${n} pt`;
  if(account.benefit_kind==="voucher"){
    const unitYen=voucherUnitYen(account);
    if(unitYen!=null) return `¥${num(value*unitYen)}（${n}枚）`;
    return `${n}枚`;
  }
  if(account.benefit_kind==="admission") return `${n}枚`;
  if(account.native_unit==="month") return `${n}か月`;
  if(account.native_unit==="membership") return `${n}口`;
  return `${n}${["count","unit"].includes(account.native_unit)?"個":` ${account.native_unit}`}`;
}
function scheduledValueText(item:YutaiScheduledGrantItem){
  const n=num(item.expected_native_value);
  if(item.native_unit==="yen") return `+¥${n}`;
  if(["point","points","pt"].includes(item.native_unit)) return `+${n} pt`;
  if(item.expected_yen!=null) return `+¥${num(item.expected_yen)}`;
  return `+${n} ${item.native_unit}`;
}
function legacyValueText(reward:RewardV2LegacyReward){
  const n=num(reward.remaining_value);
  if(reward.title.includes("ポイント")) return `${n} pt`;
  if(reward.track_mode==="amount") return `¥${n}`;
  if(reward.unit_yen!=null) return `¥${num(reward.remaining_value*reward.unit_yen)}（${n}枚）`;
  return `${n}個`;
}
const benefitLabels:Record<RewardV2BenefitKind,string>={stored_value:"電子マネー・金額残高",points:"ポイント",voucher:"商品券・金券",admission:"入場・招待",discount:"割引優待",service_access:"サービス利用権",service_period:"サービス利用期間",choice:"選択型優待",goods:"商品優待",cashback:"還元",composite:"複合優待",other:"その他の優待"};
const statusLabels:Record<RewardV2EntitlementStatus,string>={unknown:"状態未確認",eligible:"権利あり",claim_required:"申込が必要",claimed:"申込済み",activated:"利用開始済み",fulfilled:"受取・完了",expired:"失効",waived:"利用しない",cancelled:"取消"};
const deadlineLabels:Record<RewardV2DeadlineType,string>={claim_by:"申込期限",activate_by:"利用開始期限",book_by:"予約期限",usable_from:"利用開始日",use_by:"利用期限",service_starts_at:"サービス開始",service_ends_at:"サービス終了"};
function entitlementTitle(e:RewardV2Entitlement){ const t=e.memo.split(/\n|。/).map(x=>x.trim()).find(Boolean); return t?(t.length>42?`${t.slice(0,42)}…`:t):benefitLabels[e.benefit_kind]; }
function deadlineSatisfied(e:RewardV2Entitlement,type:RewardV2DeadlineType){ if(e.status==="fulfilled") return true; if(type==="claim_by"&&["claimed","activated"].includes(e.status)) return true; if(type==="activate_by"&&e.status==="activated") return true; return false; }
function isActionDeadline(type:RewardV2DeadlineType){ return ["claim_by","activate_by","book_by","use_by","service_ends_at"].includes(type); }

type Item={id:string;date:string;title:string;value:string;meta:string;source:"残高"|"手続き"|"期限切れ";overdue:boolean};
type Group={date:string;items:Item[]};

export default function YutaiExpiryDailyView({onManage}:{onManage:()=>void}){
  const [today,setToday]=useState(localDate);
  const [query,setQuery]=useState("");
  const {state}=useYutaiRewardLedgerV2(today);
  const scheduleState=useYutaiScheduledGrants(today);
  const ledger=state.ledger;
  useEffect(()=>{const update=()=>setToday(localDate()); const timer=setInterval(update,60000); window.addEventListener("focus",update); return()=>{clearInterval(timer);window.removeEventListener("focus",update);};},[]);

  const accounts=useMemo(()=> (ledger?.accounts??[]).filter(a=>a.status==="active"&&a.recorded_balance_native>0),[ledger]);
  const unknown=useMemo(()=> (ledger?.entitlements??[]).filter(e=>e.status==="unknown"),[ledger]);
  const legacy=useMemo(()=> (ledger?.unassigned_rewards??[]).filter(r=>!r.archived_at&&r.remaining_value>0),[ledger]);
  const scheduled=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("ja");
    const rows=(scheduleState.data?.items??[]).filter(item=>item.status==="scheduled");
    const visible=q?rows.filter(item=>`${item.account_title} ${item.title} ${item.company}`.toLocaleLowerCase("ja").includes(q)):rows;
    return [...visible].sort((a,b)=>a.scheduled_on.localeCompare(b.scheduled_on)||a.title.localeCompare(b.title,"ja"));
  },[scheduleState.data,query]);

  const items=useMemo(()=>{
    const out:Item[]=[];
    for(const a of accounts){
      if(a.expired_unprocessed_native>0){
        const expiredLots=a.lots.filter(l=>!l.archived_at&&l.remaining_value>0&&l.expires_on&&l.expires_on<today).map(l=>l.expires_on as string).sort();
        const date=a.rolling_expires_on&&a.rolling_expires_on<today?a.rolling_expires_on:expiredLots[0]??today;
        out.push({id:`expired:${a.id}`,date,title:a.title,value:accountValueText(a,a.expired_unprocessed_native),meta:"期限を過ぎた残高があります",source:"期限切れ",overdue:true});
      }
      if(a.available_balance_native>0&&a.nearest_expiry) out.push({id:`account:${a.id}`,date:a.nearest_expiry,title:a.title,value:accountValueText(a),meta:benefitLabels[a.benefit_kind],source:"残高",overdue:a.nearest_expiry<today});
    }
    for(const e of ledger?.entitlements??[]){
      if(["fulfilled","expired","waived","cancelled"].includes(e.status)) continue;
      for(const d of e.deadlines){
        if(d.completed_at||!isActionDeadline(d.deadline_type)||deadlineSatisfied(e,d.deadline_type)) continue;
        out.push({id:`deadline:${d.id}`,date:d.due_on,title:entitlementTitle(e),value:deadlineLabels[d.deadline_type],meta:`${benefitLabels[e.benefit_kind]}・${statusLabels[e.status]}`,source:"手続き",overdue:d.due_on<today});
      }
    }
    return out.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ja"));
  },[accounts,ledger,today]);

  const noExpiry=useMemo(()=>accounts.filter(a=>a.available_balance_native>0&&!a.nearest_expiry).sort((a,b)=>a.title.localeCompare(b.title,"ja")),[accounts]);
  const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase("ja"); return q?items.filter(i=>`${i.title} ${i.value} ${i.meta}`.toLocaleLowerCase("ja").includes(q)):items;},[items,query]);
  const groups=useMemo(()=>{const map=new Map<string,Item[]>(); for(const item of filtered){const list=map.get(item.date)??[];list.push(item);map.set(item.date,list);} return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({date,items:rows}));},[filtered]);
  const overdue=items.filter(i=>i.overdue).length;
  const month=items.filter(i=>!i.overdue&&i.date.startsWith(today.slice(0,7))).length;
  const nextDate=items.find(i=>i.date>=today)?.date??null;
  const nextCount=nextDate?items.filter(i=>i.date===nextDate).length:0;
  const review=unknown.length+legacy.length;
  const past=groups.filter(g=>g.date<today), future=groups.filter(g=>g.date>=today), primary=[...past,...future.slice(0,3)], later=future.slice(3);
  const scheduledPrimary=scheduled.slice(0,3), scheduledLater=scheduled.slice(3);

  if(state.status==="signed_out"||!state.ownerId) return <section className={styles.hero}><h1>株主優待期限帳</h1><p>優待データを見るにはログインが必要です。</p><a className={styles.primaryLink} href="/account">ログイン画面へ</a></section>;
  if(!ledger) return <section className={styles.hero}><h1>株主優待期限帳</h1><p>{state.error?`優待データを取得できませんでした: ${state.error}`:"優待データを読み込んでいます…"}</p></section>;

  return <>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>期限</p><h1>次に使う優待が、すぐ分かる。</h1><p className={styles.heroCopy}>期限が近い順にまとめています。普段はここだけ見れば大丈夫です。</p></div>
      {overdue>0&&<div className={styles.alert} role="alert"><strong>期限を過ぎた確認項目が {overdue}件あります。</strong></div>}
      <div className={styles.summaryGrid} aria-label="期限サマリー">
        <div className={styles.summaryCard}><small>今月期限</small><strong>{month===0?"なし":`${month}件`}</strong><span>{month===0?"今月は急ぎなし":"今月中に対応"}</span></div>
        <div className={styles.summaryCard}><small>次の期限</small><strong>{nextDate?shortDate(nextDate):"なし"}</strong><span>{nextDate?`${nextCount}件`:"期限登録なし"}</span></div>
        <button className={`${styles.summaryCard} ${styles.summaryLink}`} type="button" onClick={onManage}><small>要確認</small><strong>{review}件</strong><span>{review?"管理で確認":"確認事項なし"}</span></button>
      </div>
    </section>
    <details className={styles.toolbox}><summary>検索・絞り込み</summary><div className={styles.toolboxBody}><label>優待名で検索<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="例: U-NEXT / コメダ" /></label>{query&&<button type="button" onClick={()=>setQuery("")}>検索をクリア</button>}</div></details>
    <section className={styles.deadlines}>
      <div className={styles.sectionHeader}><div><h2>期限がある優待</h2><p>同じ期限のものをまとめています。</p></div><span>{filtered.length}件</span></div>
      {primary.length===0&&<div className={styles.empty}>条件に一致する期限付き優待はありません。</div>}
      {primary.map(g=><DeadlineGroupView key={g.date} group={g} today={today}/>) }
      {later.length>0&&<details className={styles.later}><summary>その先の期限を見る（{later.reduce((s,g)=>s+g.items.length,0)}件）</summary><div className={styles.laterBody}>{later.map(g=><DeadlineGroupView key={g.date} group={g} today={today}/>)}</div></details>}
    </section>
    {scheduleState.status==="error"&&<div className={styles.alert} role="alert">付与予定を取得できませんでした: {scheduleState.error}</div>}
    {scheduled.length>0&&<section className={styles.deadlines}>
      <div className={styles.sectionHeader}><div><h2>今後の付与予定</h2><p>まだ残高・取得実績には含めていません。付与日を迎えると自動的に残高へ移ります。</p></div><span>{scheduled.length}件</span></div>
      <div className={styles.simpleList}>{scheduledPrimary.map(item=><ScheduledGrantRow key={item.id} item={item} today={today}/>)}</div>
      {scheduledLater.length>0&&<details className={styles.later}><summary>その先の付与予定を見る（{scheduledLater.length}件）</summary><div className={styles.simpleList}>{scheduledLater.map(item=><ScheduledGrantRow key={item.id} item={item} today={today}/>)}</div></details>}
    </section>}
    {noExpiry.length>0&&<details className={styles.secondarySection}><summary>期限なし・期限未設定の残高（{noExpiry.length}件）</summary><div className={styles.simpleList}>{noExpiry.map(a=><div className={styles.simpleRow} key={a.id}><div><strong>{a.title}</strong><span>{benefitLabels[a.benefit_kind]}</span></div><b>{accountValueText(a)}</b></div>)}</div></details>}
    {review>0&&<section className={styles.review}><button type="button" onClick={onManage}>要確認 {review}件を管理画面で確認</button><div className={styles.reviewBody}>{unknown.map(e=><p key={e.id}><strong>{entitlementTitle(e)}</strong> — {statusLabels[e.status]}</p>)}{legacy.map(r=><p key={r.id}><strong>{r.title}</strong> — {legacyValueText(r)}</p>)}</div></section>}
  </>;
}

function ScheduledGrantRow({item,today}:{item:YutaiScheduledGrantItem;today:string}){
  return <div className={styles.simpleRow}><div><strong>{dateLabel(item.scheduled_on,today)}　{item.account_title}</strong><span>付与予定・予定失効 {item.expected_expires_on?dateLabel(item.expected_expires_on,today):"未設定"}</span></div><b>{scheduledValueText(item)}</b></div>;
}

function DeadlineGroupView({group,today}:{group:Group;today:string}){
  const overdue=group.date<today;
  return <section className={`${styles.deadlineGroup} ${overdue?styles.overdueGroup:""}`}><header className={styles.deadlineHeader}><div><strong>{dateLabel(group.date,today)}</strong><span>{overdue?"期限超過":group.date===today?"今日まで":"まで"}</span></div><b>{group.items.length}件</b></header><div className={styles.deadlineRows}>{group.items.map(item=><div className={styles.deadlineRow} key={item.id}><div className={styles.itemMain}><strong>{item.title}</strong><span>{item.meta}</span></div><div className={styles.itemValue}><b>{item.value}</b><span>{item.source}</span></div></div>)}</div></section>;
}
