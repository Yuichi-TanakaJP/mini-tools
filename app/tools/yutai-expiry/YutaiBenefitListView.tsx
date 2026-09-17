"use client";

import { useMemo, useState } from "react";
import { useYutaiBenefitSummary } from "../../../lib/yutai/benefit-summary-browser";
import type { YutaiBenefitSummaryItem } from "../../../lib/yutai/benefit-summary";
import styles from "./YutaiBenefitListView.module.css";

type Scope = "all" | "current" | "past";

function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function yen(value:number){return `¥${Math.round(value).toLocaleString("ja-JP")}`;}
function native(value:number,item:YutaiBenefitSummaryItem){
  const n=value.toLocaleString("ja-JP",{maximumFractionDigits:2});
  if(item.native_unit==="yen") return `¥${n}`;
  if(["point","points","pt"].includes(item.native_unit??"")) return `${n} pt`;
  if(item.native_unit==="month") return `${n}か月`;
  if(item.native_unit==="membership") return `${n}口`;
  if(item.native_unit==="count"||item.benefit_kind==="voucher"||item.benefit_kind==="admission") return `${n}枚`;
  if(item.native_unit) return `${n} ${item.native_unit}`;
  return n;
}
function metric(valueNative:number,valueYen:number,item:YutaiBenefitSummaryItem){
  if(item.benefit_kind==="admission") return {main:native(valueNative,item),sub:valueYen>0?`${yen(valueYen)}相当`:null};
  if(item.benefit_kind==="voucher"&&item.native_unit==="count") return {main:yen(valueYen),sub:native(valueNative,item)};
  if(item.benefit_kind==="points") return {main:native(valueNative,item),sub:valueYen>0?`${yen(valueYen)}相当`:null};
  if(item.native_unit==="yen"||item.benefit_kind==="stored_value") return {main:yen(valueYen),sub:null};
  if(valueNative>0&&item.native_unit) return {main:native(valueNative,item),sub:valueYen>0?`${yen(valueYen)}相当`:null};
  return {main:yen(valueYen),sub:null};
}
function Metric({label,nativeValue,yenValue,item}:{label:string;nativeValue:number;yenValue:number;item:YutaiBenefitSummaryItem}){
  const value=metric(nativeValue,yenValue,item);
  return <div className={styles.metric}><small>{label}</small><b>{value.main}</b>{value.sub&&<span>{value.sub}</span>}</div>;
}

export default function YutaiBenefitListView({onOpenHistory}:{onOpenHistory:(item:YutaiBenefitSummaryItem)=>void}){
  const [today]=useState(localDate);
  const summary=useYutaiBenefitSummary(today);
  const [scope,setScope]=useState<Scope>("all");
  const [query,setQuery]=useState("");
  const items=summary.data?.items??[];
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("ja");
    return items.filter(item=>{
      const hasNow=item.current_native>0||item.current_yen>0||item.scheduled_native>0||item.scheduled_yen>0;
      if(scope==="current"&&!hasNow) return false;
      if(scope==="past"&&hasNow) return false;
      if(!needle) return true;
      return `${item.title} ${item.company} ${item.group_key}`.toLocaleLowerCase("ja").includes(needle);
    });
  },[items,query,scope]);
  const currentCount=items.filter(i=>i.current_native>0||i.current_yen>0).length;
  const scheduledCount=items.filter(i=>i.scheduled_native>0||i.scheduled_yen>0).length;

  if(summary.status==="loading"&&!summary.data) return <section className={styles.view}><p>優待一覧を集計しています…</p></section>;
  if(summary.status==="signed_out") return <section className={styles.view}><p>優待一覧を見るにはログインが必要です。</p></section>;
  if(!summary.data) return <section className={styles.view}><p>優待一覧を取得できませんでした。{summary.error??""}</p><button type="button" onClick={()=>void summary.reload()}>再読み込み</button></section>;

  return <section className={styles.view}>
    <header className={styles.header}>
      <div><h2>優待ごとの内訳</h2><p>全体実績を、同じ優待の過去分・現在分・今後予定に分けて確認できます。カードを開くと詳しい通算が表示されます。</p></div>
      <div className={styles.summary}><span className={styles.badge}>全 {summary.data.count}種類</span><span className={styles.badge}>現在あり {currentCount}種類</span>{scheduledCount>0&&<span className={styles.badge}>今後予定 {scheduledCount}種類</span>}</div>
    </header>

    <div className={styles.tools}>
      <div className={styles.filters} role="group" aria-label="優待一覧の絞り込み">
        {(["all","current","past"] as const).map(value=><button key={value} type="button" aria-pressed={scope===value} onClick={()=>setScope(value)}>{value==="all"?"すべて":value==="current"?"現在・予定あり":"過去のみ"}</button>)}
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="優待名・会社名で検索" aria-label="優待一覧を検索" />
    </div>

    <div className={styles.list}>
      {filtered.length===0&&<div className={styles.empty}>条件に一致する優待はありません。</div>}
      {filtered.map(item=>{
        const current=metric(item.current_native,item.current_yen,item);
        const acquired=metric(item.acquired_native,item.acquired_yen,item);
        return <details className={styles.card} key={item.group_key}>
          <summary className={styles.cardSummary}>
            <span className={styles.summaryIdentity}>
              <span className={styles.title}><strong>{item.title}</strong>{item.company&&<span>{item.company}</span>}</span>
              <span className={styles.flags}>{item.source_count>1&&<span className={styles.flag}>{item.source_count}件を統合</span>}{item.history_partial&&<span className={styles.flag}>履歴一部</span>}{item.has_unvalued&&<span className={styles.flag}>一部未換算</span>}</span>
            </span>
            <span className={styles.compactMetrics}>
              <span className={styles.compactMetric}><small>現在</small><b>{current.main}</b>{current.sub&&<span>{current.sub}</span>}</span>
              <span className={styles.compactMetric}><small>累計取得</small><b>{acquired.main}</b>{acquired.sub&&<span>{acquired.sub}</span>}</span>
            </span>
            <span className={styles.expandLabel} aria-hidden="true">詳細 <span className={styles.chevron}>⌄</span></span>
          </summary>
          <div className={styles.cardBody}>
            <div className={styles.metrics}>
              <Metric label="累計取得" nativeValue={item.acquired_native} yenValue={item.acquired_yen} item={item}/>
              <Metric label="利用" nativeValue={item.used_native} yenValue={item.used_yen} item={item}/>
              <Metric label="失効" nativeValue={item.expired_native} yenValue={item.expired_yen} item={item}/>
              <Metric label="現在" nativeValue={item.current_native} yenValue={item.current_yen} item={item}/>
              <Metric label="今後予定" nativeValue={item.scheduled_native} yenValue={item.scheduled_yen} item={item}/>
            </div>
            <div className={styles.footer}>
              <span>{item.next_scheduled_on?`次回予定 ${item.next_scheduled_on}${item.next_expected_expires_on?` / 予定期限 ${item.next_expected_expires_on}`:""}`:"記録済み優待"}</span>
              {(item.account_keys.length>0||item.reward_ids.length>0)&&<button className={styles.historyButton} type="button" onClick={()=>onOpenHistory(item)}>この優待の履歴</button>}
            </div>
          </div>
        </details>;
      })}
    </div>
  </section>;
}
