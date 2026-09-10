"use client";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { getYutaiRepository } from "@/lib/yutai/browser";
import { isObject } from "@/lib/yutai/contracts";
import type { ViewState } from "@/lib/yutai/repository";
import { localToday } from "@/lib/yutai/reward-list";

export function DatabaseRewardTotals({ view }: { view: ViewState }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false); const alive = useRef(true), abort = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<number | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  async function load() {
    if (busy || view.stale) return;
    setBusy(true); setResult(null); setError("");
    const repo = getYutaiRepository(), identity = repo.getIdentity();
    abort.current = new AbortController(); const timer = setTimeout(() => abort.current?.abort(), 15_000);
    try {
      const { data, error: authError } = await createSupabaseBrowserClient().auth.getSession();
      if (authError || !data.session || data.session.user.id !== identity.owner) throw new Error("ログイン状態を確認してください。");
      const env = getSupabaseEnv();
      const response = await fetch(`${env.url}/rest/v1/rpc/stock_notes_get_yutai_reward_totals`, {
        method: "POST", headers: { apikey: env.anonKey, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_today: localToday() }), signal: abort.current.signal,
      });
      const raw: unknown = await response.json();
      if (!response.ok || !isObject(raw) || raw.schema_version !== 1 ||
        !["received_known_yen", "consumed_known_yen", "expiry_remaining_yen"].every(k => typeof raw[k] === "string" && /^\d+(\.\d+)?$/.test(raw[k] as string)) ||
        !["unknown_event_count", "unknown_initial_count", "unknown_unit_count", "mode_segment_count", "deleted_reward_count"].every(k => Number.isSafeInteger(raw[k]) && (raw[k] as number) >= 0) ||
        typeof raw.restore_history_present !== "boolean") throw new Error("集計を確認できません。APIの適用状態・通信を確認してください。0円とは判定していません。");
      if (!alive.current || repo.getIdentity().sessionRevision !== identity.sessionRevision) return;
      setSnapshot(view.fetchedAt); setResult(raw);
    } catch (cause) { if (alive.current) setError((cause as Error).name === "AbortError" ? "集計が時間内に取得できませんでした。" : (cause as Error).message); }
    finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  const visible = result && !view.stale && snapshot === view.fetchedAt && result.today === localToday();
  return <section aria-label="優待の累計確認"><h2>受取・利用の累計確認</h2>
    <p>単位変更前の履歴も参照します。初回移行の分類不明履歴や額面未設定は、完全な累計に含められません。</p>
    <button type="button" disabled={busy || view.stale || !!view.maintenance} onClick={() => void load()}>累計をDBから確認</button>
    {busy && <p role="status">集計しています。</p>}{error && <p role="alert">{error}</p>}
    {visible && (result.restore_history_present ? <p>復元履歴があるため、累計の重複検証が必要です。確定額は表示しません。</p> : <>
      <p>確認できた受取・補充: {String(result.received_known_yen)}円 / 利用: {String(result.consumed_known_yen)}円</p>
      <p>現在の期限切れ残高: {String(result.expiry_remaining_yen)}円（累計失効額ではありません）</p>
      <p>累計失効額: 未確定（失効イベントが記録されていないため）。集計基準日: {String(result.today)}</p>
      <p>分類不明履歴: {String(result.unknown_event_count)}件 / 由来未確定初期値: {String(result.unknown_initial_count)}件 / 額面未設定: {String(result.unknown_unit_count)}区間</p>
      <p>単位変更: {String(result.mode_segment_count)}区間 / 削除済み優待: {String(result.deleted_reward_count)}件を参照。訂正・取消を新しい利用として加算しません。</p>
    </>)}
  </section>;
}
