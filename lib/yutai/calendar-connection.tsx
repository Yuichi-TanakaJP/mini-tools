"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getYutaiRepository } from "./browser";
import { getSessionActionRunner } from "./action-runner";
import { calendarProjection, type CommandStep } from "./calendar";
import type { ViewState } from "./repository";

export function useCalendarConnection(view: ViewState, year: number, month: number) {
  const [runner] = useState(() => getSessionActionRunner(getYutaiRepository(), view.sessionRevision));
  const action = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);
  const projection = useMemo(() => view.data ? calendarProjection(view.data, year) : null, [view.data, year]);
  const blocked = action.status === "running" || action.status === "paused";
  useEffect(() => {
    if (!blocked) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      event.preventDefault(); event.stopPropagation();
      window.alert("保存処理が未完了です。再確認または最新データの確認を済ませてから移動してください。");
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [blocked]);
  return { view, projection, action, blocked,
    save: (steps: CommandStep[]) => runner.start(steps, month),
    retry: () => runner.retry(), reviewRejected: () => runner.reviewRejected(),
    refresh: () => getYutaiRepository().load(month, true).catch(() => undefined),
  };
}
export type CalendarConnection = ReturnType<typeof useCalendarConnection>;
export function YutaiConnectionStatus({ connection, scope = "カレンダーのみ" }: { connection: CalendarConnection; scope?: string }) {
  const { view, action, blocked } = connection;
  return <aside role="status" aria-live="polite" style={{ padding: 12, marginBottom: 12, border: "1px solid var(--border, #94a3b8)", borderRadius: 8 }}>
    <strong>Supabase接続の検証モード（{scope}）</strong>
    <p>他の画面はまだ従来の保存先です。本番切替は未完了です。</p>
    <p>{view.status === "signed_out" ? "Supabaseへのログインが必要です。" : !view.data ? "優待データを取得しています。" :
      `最終取得: ${new Date(view.fetchedAt).toLocaleString("ja-JP")} ${view.stale ? "（最新ではない可能性があります）" : ""}`}</p>
    {view.error && <p role="alert">データを取得できません。再取得するか、ログイン状態を確認してください。</p>}
    {action.message && <p role={action.status === "paused" ? "alert" : undefined}>{scope === "カレンダーのみ" && action.month ? `${action.month}月の操作: ` : ""}{action.message}</p>}
    <button type="button" onClick={() => void connection.refresh()} disabled={blocked || view.status === "loading"}>最新データを再取得</button>
    {action.status === "paused" && (action.retryable ?
      <button type="button" onClick={() => void connection.retry()}>同じ要求を再確認・続行</button> :
      <button type="button" onClick={() => void connection.reviewRejected()}>最新データを確認して編集をやり直す</button>)}
    {view.status === "signed_out" && <a href="/account">ログイン画面へ</a>}
  </aside>;
}
