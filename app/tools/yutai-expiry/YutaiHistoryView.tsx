"use client";

import { useMemo, useState } from "react";
import { useYutaiRewardHistory } from "../../../lib/yutai/reward-history-browser";
import type { YutaiHistoryCategory, YutaiRewardHistoryItem } from "../../../lib/yutai/reward-history";
import styles from "./YutaiHistoryView.module.css";

type Filter = "all" | "acquired" | "used" | "expired";
export type YutaiHistoryFocus = { title:string; accountKeys:string[]; rewardIds:string[] };
const labels: Record<YutaiHistoryCategory,string> = { acquired:"取得",used:"利用",expired:"失効",transfer:"移動",conversion:"交換",adjustment:"補正" };

function formatDate(value:string){ return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)); }
function nativeText(value:number,item:YutaiRewardHistoryItem){
  const n=Math.abs(value).toLocaleString("ja-JP",{maximumFractionDigits:2});
  if(item.native_unit==="yen") return `¥${n}`;
  if(["point","points","pt"].includes(item.native_unit)) return `${n} pt`;
  if(item.native_unit==="count") return `${n}枚`;
  return `${n} ${item.native_unit}`;
}
function valueText(item:YutaiRewardHistoryItem){
  const sign=item.native_delta>0?"+":item.native_delta<0?"−":"";
  if(item.yen_delta!=null) return `${sign}¥${Math.abs(item.yen_delta).toLocaleString("ja-JP",{maximumFractionDigits:0})}`;
  return `${sign}${nativeText(item.native_delta,item)}`;
}
function cleanedDetail(value:string|null){
  if(!value) return null;
  if(value.includes("旧QUOカードadjusted増加を取得履歴へ正規化")) return null;
  if(value==="取得履歴へ正規化") return null;
  return value.replace("（履歴正規化済み）","");
}

export default function YutaiHistoryView({focus,onClearFocus}:{focus?:YutaiHistoryFocus|null;onClearFocus?:()=>void}){
  const history=useYutaiRewardHistory(300);
  const [filter,setFilter]=useState<Filter>("all");
  const [query,setQuery]=useState("");
  const items=history.data?.items??[];
  const focusedItems=useMemo(()=>{
    if(!focus) return items;
    const accountKeys=new Set(focus.accountKeys);
    const rewardIds=new Set(focus.rewardIds);
    return items.filter(item=>(item.account_key!=null&&accountKeys.has(item.account_key))||rewardIds.has(item.reward_id));
  },[items,focus]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("ja");
    return focusedItems.filter(item=>{
      if(filter!=="all"&&item.event_category!==filter) return false;
      if(!needle) return true;
      return `${item.display_title} ${item.company} ${item.merchant_name??""} ${item.detail??""}`.toLocaleLowerCase("ja").includes(needle);
    });
  },[focusedItems,filter,query]);
  const counts=useMemo(()=>({
    acquired:focusedItems.filter(i=>i.event_category==="acquired").length,
    used:focusedItems.filter(i=>i.event_category==="used").length,
    expired:focusedItems.filter(i=>i.event_category==="expired").length,
  }),[focusedItems]);

  if(history.status==="loading"&&!history.data) return <section className={styles.view}><p>履歴を読み込んでいます…</p></section>;
  if(history.status==="signed_out") return <section className={styles.view}><p>履歴を見るにはログインが必要です。</p></section>;
  if(!history.data) return <section className={styles.view}><p>履歴を取得できませんでした。{history.error??""}</p><button type="button" onClick={()=>void history.reload()}>再読み込み</button></section>;

  return <section className={styles.view}>
    <header className={styles.header}>
      <h2>{focus?`${focus.title}の履歴`:"優待の履歴"}</h2>
      <p>いつ取得し、どこでいくら使い、何が失効したかを時系列で確認します。</p>
      {focus&&<div className={styles.focus}><span>優待一覧から絞り込み中</span>{onClearFocus&&<button type="button" onClick={onClearFocus}>すべての履歴に戻す</button>}</div>}
    </header>

    <div className={styles.summary}>
      <span>取得 {counts.acquired}件</span><span>利用 {counts.used}件</span><span>失効 {counts.expired}件</span>
    </div>

    <div className={styles.tools}>
      <div className={styles.filters} role="group" aria-label="履歴種別">
        {(["all","used","acquired","expired"] as const).map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==="all"?"すべて":value==="used"?"利用":value==="acquired"?"取得":"失効"}</button>)}
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="優待名・利用先で検索" aria-label="履歴を検索" />
    </div>

    <div className={styles.list}>
      {filtered.length===0&&<div className={styles.empty}>条件に一致する履歴はありません。</div>}
      {filtered.map(item=><HistoryRow key={item.event_id} item={item}/>) }
    </div>
  </section>;
}

function HistoryRow({item}:{item:YutaiRewardHistoryItem}){
  const detail=cleanedDetail(item.detail);
  return <article className={styles.row}>
    <div className={styles.when}>{formatDate(item.occurred_at)}</div>
    <div className={styles.main}>
      <div className={styles.titleLine}><strong>{item.display_title}</strong><span className={`${styles.kind} ${styles[item.event_category]}`}>{labels[item.event_category]}</span></div>
      {item.company&&<span className={styles.company}>{item.company}</span>}
      {item.merchant_name&&<div className={styles.merchant}><strong>利用先: {item.merchant_name}</strong>{item.merchant_amount_native!=null&&<span>{nativeText(item.merchant_amount_native,item)}</span>}{item.unattributed_amount_native!=null&&item.unattributed_amount_native>0&&<span>内訳未特定 {nativeText(item.unattributed_amount_native,item)}</span>}</div>}
      {detail&&<p>{detail}</p>}
    </div>
    <div className={styles.value}>{valueText(item)}</div>
  </article>;
}
