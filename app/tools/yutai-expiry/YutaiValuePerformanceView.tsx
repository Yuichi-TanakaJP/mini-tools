"use client";

import { useState } from "react";
import { useYutaiValuePerformance } from "../../../lib/yutai/value-performance-browser";
import styles from "./YutaiValuePerformanceView.module.css";

function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function yen(value:number|null|undefined){return `¥${Math.round(value??0).toLocaleString("ja-JP")}`;}

export default function YutaiValuePerformanceView(){
  const [today]=useState(localDate);
  const performance=useYutaiValuePerformance(today);
  const data=performance.data;
  const summary=data?.summary;

  if(performance.status==="loading"&&!data) return <section className={styles.view}><p>実績を集計しています…</p></section>;
  if(performance.status==="signed_out") return <section className={styles.view}><p>実績を見るにはログインが必要です。</p></section>;
  if(!data||!summary) return <section className={styles.view}><p>実績を取得できませんでした。{performance.error??""}</p><button type="button" onClick={()=>void performance.reload()}>再読み込み</button></section>;

  const classifiedTotal=summary.used_yen+summary.current_yen+summary.expired_yen+summary.waived_yen+summary.uncertain_yen;
  const pct=(value:number)=>classifiedTotal>0?`${Math.max(0,(value/classifiedTotal)*100)}%`:"0%";
  const qualityIssues=summary.unvalued_reward_count+summary.unvalued_entitlement_count;

  return <section className={styles.view}>
    <header className={styles.intro}>
      <h2>優待全体の実績</h2>
      <p>すべての優待を円換算して、取得・利用・失効・現在保有の全体像を確認します。この下に優待ごとの内訳を表示します。</p>
    </header>

    <div className={styles.quality}>
      <span className={styles.badge}>{summary.coverage==="complete"?"確定値":"判明分・履歴一部"}</span>
      {summary.partial_item_count>0&&<span className={styles.badge}>履歴一部 {summary.partial_item_count}件</span>}
      {qualityIssues>0&&<span className={styles.badge}>円換算未設定 {qualityIssues}件</span>}
    </div>

    <div className={styles.kpis}>
      <div className={styles.kpi}><small>累計取得価値</small><strong>{yen(summary.acquired_yen)}</strong><span className={styles.muted}>記録で判明している分</span></div>
      <div className={styles.kpi}><small>利用済み価値</small><strong>{yen(summary.used_yen)}</strong><span className={styles.muted}>利用として確定済み</span></div>
      <div className={styles.kpi}><small>失効価値</small><strong>{yen(summary.expired_yen)}</strong><span className={styles.muted}>未利用で失った分</span></div>
      <div className={styles.kpi}><small>現在保有価値</small><strong>{yen(summary.current_yen)}</strong><span className={styles.muted}>今使える判明分</span></div>
    </div>

    <section className={styles.panel}>
      <h3>取得した価値の行き先</h3>
      <p>利用・現在保有・失効など、分類できた価値の構成です。優待別の内訳はこの下の一覧で確認できます。</p>
      <div className={styles.bar} aria-label="取得価値の分類">
        <div className={styles.used} style={{width:pct(summary.used_yen)}} title={`利用 ${yen(summary.used_yen)}`} />
        <div className={styles.current} style={{width:pct(summary.current_yen)}} title={`現在 ${yen(summary.current_yen)}`} />
        <div className={styles.expired} style={{width:pct(summary.expired_yen)}} title={`失効 ${yen(summary.expired_yen)}`} />
        <div className={styles.waived} style={{width:pct(summary.waived_yen)}} title={`放棄 ${yen(summary.waived_yen)}`} />
        <div className={styles.uncertain} style={{width:pct(summary.uncertain_yen)}} title={`未確定 ${yen(summary.uncertain_yen)}`} />
      </div>
      <div className={styles.legend}>
        <span>利用 {yen(summary.used_yen)}</span><span>現在 {yen(summary.current_yen)}</span><span>失効 {yen(summary.expired_yen)}</span>
        {summary.waived_yen>0&&<span>放棄 {yen(summary.waived_yen)}</span>}{summary.uncertain_yen>0&&<span>未確定 {yen(summary.uncertain_yen)}</span>}
      </div>
    </section>

    {(summary.unclassified_increase_yen!==0||summary.unclassified_decrease_yen!==0||summary.expired_unprocessed_yen!==0)&&<section className={styles.warning}>
      <strong>旧履歴の未分類があります</strong>
      <span>未分類増加 {yen(summary.unclassified_increase_yen)} / 未分類減少 {yen(summary.unclassified_decrease_yen)}</span>
      {summary.expired_unprocessed_yen>0&&<span>期限切れ未処理 {yen(summary.expired_unprocessed_yen)}</span>}
      <small>取得・利用・失効のどれかを根拠なく推測せず、別枠のまま残しています。</small>
    </section>}
  </section>;
}
