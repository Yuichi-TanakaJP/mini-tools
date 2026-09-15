"use client";

import { useState } from "react";
import YutaiExpiryDailyView from "./YutaiExpiryDailyView";
import YutaiValuePerformanceView from "./YutaiValuePerformanceView";
import { RewardLedgerV2Workspace } from "./RewardLedgerV2Workspace";
import DatabaseRewardsGate from "./DatabaseRewardsGate";
import styles from "./YutaiExpiryApp.module.css";

type View = "deadline" | "performance" | "management";

export default function YutaiExpiryApp({ scanEnabled = false }: { scanEnabled?: boolean }) {
  const [view, setView] = useState<View>("deadline");
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1>株主優待期限帳</h1>
          <p>期限・成果・管理を、同じデータから別の見方で確認します。</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="優待期限帳の表示">
        <button type="button" role="tab" aria-selected={view === "deadline"} onClick={() => setView("deadline")}>期限</button>
        <button type="button" role="tab" aria-selected={view === "performance"} onClick={() => setView("performance")}>実績</button>
        <button type="button" role="tab" aria-selected={view === "management"} onClick={() => setView("management")}>管理</button>
      </nav>

      <div className={styles.content}>
        {view === "deadline" && <YutaiExpiryDailyView onManage={() => setView("management")} />}
        {view === "performance" && <YutaiValuePerformanceView />}
        {view === "management" && (
          <section className={styles.management}>
            <div className={styles.managementIntro}>
              <h2>管理・履歴</h2>
              <p>Lot、利用履歴、Account、状態確認、旧台帳、撮影・画像取込などを扱います。</p>
            </div>
            <RewardLedgerV2Workspace />
            <DatabaseRewardsGate scanEnabled={scanEnabled} />
          </section>
        )}
      </div>
    </main>
  );
}
