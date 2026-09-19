"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getYutaiRepository } from "./browser";
import { getSessionActionRunner } from "./action-runner";
import { calendarProjection, type CommandStep } from "./calendar";
import type { ViewState } from "./repository";
import { yutaiDatabaseCanonical } from "./cutover";
import styles from "./connection-status.module.css";

export function useCalendarConnection(view: ViewState, year: number, month: number) {
  const [runner] = useState(() => getSessionActionRunner(getYutaiRepository(), view.sessionRevision));
  const action = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);
  const projection = useMemo(() => view.data ? calendarProjection(view.data, year) : null, [view.data, year]);
  const blocked = !!view.maintenance || action.status === "running" || action.status === "paused";
  useEffect(() => {
    if (!blocked) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      if (view.maintenance && event.target.closest("a")?.getAttribute("href") === "/tools/data-transfer") return;
      event.preventDefault(); event.stopPropagation();
      window.alert("保存処理が未完了です。再確認または最新データの確認を済ませてから移動してください。");
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [blocked, view.maintenance]);
  return { view, projection, action, blocked,
    save: (steps: CommandStep[]) => runner.start(steps, month),
    retry: () => runner.retry(), reviewRejected: () => runner.reviewRejected(),
    refresh: () => getYutaiRepository().load(month, true).catch(() => undefined),
  };
}
export type CalendarConnection = ReturnType<typeof useCalendarConnection>;
export function YutaiConnectionStatus({ connection, scope = "カレンダーのみ" }: { connection: CalendarConnection; scope?: string }) {
  const { view, action, blocked } = connection;
  const attention = !!view.maintenance || !!view.error || view.status === "signed_out" || action.status === "paused";
  const label = view.maintenance ? "復元確認中" : action.status === "paused" ? "保存の確認が必要です"
    : action.status === "running" ? "保存中…" : view.status === "signed_out" ? "ログインが必要です"
    : view.error ? "更新できませんでした" : view.status === "loading" || !view.data ? "読み込み中…"
    : view.stale ? "最新情報を確認してください" : action.status === "saved" ? "保存しました" : "クラウド保存";
  return <aside className={`${styles.status} ${attention ? styles.attention : ""}`} aria-label="保存状態">
    <div className={styles.bar}>
      <span className={styles.label} role="status" aria-live="polite"><span className={styles.dot} aria-hidden="true" />{label}</span>
      <button className={styles.refresh} type="button" onClick={() => void connection.refresh()} disabled={blocked || view.status === "loading"} aria-label="最新データを再取得">↻ 更新</button>
      <details className={styles.details}>
        <summary aria-label="保存について">ⓘ</summary>
        <div className={styles.popover}>
          <strong>保存について</strong>
          <p>{yutaiDatabaseCanonical() ? "編集内容は保存操作でクラウドに保存され、同じアカウントの端末で利用できます。"
            : "Supabase接続の検証モードです。他の画面はまだ従来の保存先です。本番切替は未完了です。"}</p>
          <p>保存先: Supabase（{scope}）。旧端末データは保管用です。</p>
          {view.fetchedAt !== null && <p>最終取得: {new Date(view.fetchedAt).toLocaleString("ja-JP")}</p>}
        </div>
      </details>
    </div>
    <div className={styles.messages}>
    {view.maintenance && <p>復元確認中のため保存を停止しています。<a href="/tools/data-transfer">データ入出力で結果を確認</a></p>}
    {view.stale && view.data && <p>表示が最新ではない可能性があります。{view.fetchedAt !== null && `最終取得: ${new Date(view.fetchedAt).toLocaleString("ja-JP")}`}</p>}
    {view.error && <p role="alert">データを取得できません。再取得するか、ログイン状態を確認してください。</p>}
    {action.message && action.status !== "saved" && <p role={action.status === "paused" ? "alert" : undefined}>{scope === "カレンダーのみ" && action.month ? `${action.month}月の操作: ` : ""}{action.message}</p>}
    {action.status === "paused" && (action.retryable ?
      <button type="button" onClick={() => void connection.retry()}>同じ要求を再確認・続行</button> :
      <button type="button" onClick={() => void connection.reviewRejected()}>最新データを確認して編集をやり直す</button>)}
    {view.status === "signed_out" && <a href="/account">ログイン画面へ</a>}
    </div>
  </aside>;
}
