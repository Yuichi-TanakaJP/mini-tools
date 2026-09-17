"use client";

import { useState } from "react";
import type { YutaiBenefitSummaryItem } from "../../../lib/yutai/benefit-summary";
import YutaiExpiryDailyView from "./YutaiExpiryDailyView";
import YutaiBenefitListView from "./YutaiBenefitListView";
import YutaiHistoryView, { type YutaiHistoryFocus } from "./YutaiHistoryView";
import YutaiEntitlementUsagePanel from "./YutaiEntitlementUsagePanel";
import YutaiValuePerformanceView from "./YutaiValuePerformanceView";
import { RewardLedgerV2Workspace } from "./RewardLedgerV2Workspace";
import DatabaseRewardsGate from "./DatabaseRewardsGate";
import styles from "./YutaiExpiryApp.module.css";

type View = "deadline" | "benefits" | "history" | "performance" | "management";

export default function YutaiExpiryApp({ scanEnabled = false }: { scanEnabled?: boolean }) {
  const [view, setView] = useState<View>("deadline");
  const [historyFocus,setHistoryFocus] = useState<YutaiHistoryFocus|null>(null);
  const openHistory = (item:YutaiBenefitSummaryItem) => {
    setHistoryFocus({title:item.title,accountKeys:item.account_keys,rewardIds:item.reward_ids});
    setView("history");
  };
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1>株主優待期限帳</h1>
          <p>期限・優待一覧・履歴・実績・管理を、同じデータから別の見方で確認します。</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="優待期限帳の表示">
        <button type="button" role="tab" aria-selected={view === "deadline"} onClick={() => setView("deadline")}>期限</button>
        <button type="button" role="tab" aria-selected={view === "benefits"} onClick={() => setView("benefits")}>優待一覧</button>
        <button type="button" role="tab" aria-selected={view === "history"} onClick={() => {setHistoryFocus(null);setView("history");}}>履歴</button>
        <button type="button" role="tab" aria-selected={view === "performance"} onClick={() => setView("performance")}>実績</button>
        <button type="button" role="tab" aria-selected={view === "management"} onClick={() => setView("management")}>管理</button>
      </nav>

      <div className={styles.content}>
        {view === "deadline" && <YutaiExpiryDailyView onManage={() => setView("management")} />}
        {view === "benefits" && <YutaiBenefitListView onOpenHistory={openHistory} />}
        {view === "history" && <><YutaiHistoryView focus={historyFocus} onClearFocus={()=>setHistoryFocus(null)} />{!historyFocus&&<YutaiEntitlementUsagePanel />}</>}
        {view === "performance" && <YutaiValuePerformanceView />}
        {view === "management" && (
          <section className={styles.management}>
            <div className={styles.managementIntro}>
              <h2>管理</h2>
              <p>Lot、Account、状態確認、旧台帳、撮影・画像取込などを扱います。利用・取得の時系列は「履歴」、通算は「優待一覧」で確認できます。</p>
            </div>
            <RewardLedgerV2Workspace />
            <DatabaseRewardsGate scanEnabled={scanEnabled} />
          </section>
        )}
      </div>
    </main>
  );
}
