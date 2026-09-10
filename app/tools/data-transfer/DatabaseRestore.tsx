"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getYutaiRestoreController } from "@/lib/yutai/browser";
import { collectionLabels, collections, MAX_EXPORT_BYTES, parseWorkspaceExport } from "@/lib/yutai/transfer";

export default function DatabaseRestore() {
  const [controller] = useState(getYutaiRestoreController);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [text, setText] = useState(""), [reason, setReason] = useState(""), [planId, setPlanId] = useState("");
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState(""), [reading, setReading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!state.locked) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor?.hasAttribute("download") && anchor.getAttribute("href")?.startsWith("blob:")) return;
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        event.preventDefault(); event.stopPropagation(); window.alert("復元確認中です。結果を確認してから移動してください。プランIDを控えると再読み込み後も確認できます。");
      }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [state.locked]);
  const busy = state.status === "busy" || reading;
  const p = state.preview;
  const editable = !busy && !p && !state.appliedAttempt;
  async function select(file?: File) {
    setText(""); setError(""); setReading(true);
    try {
      if (!file) return;
      if (file.size > MAX_EXPORT_BYTES) throw new Error("ファイルが10MBを超えています。");
      const input = await file.text(); await parseWorkspaceExport(input); setText(input);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "読込失敗"); }
    finally { setReading(false); }
  }
  async function download() {
    setError("");
    try {
      const plan = state.planId, output = await controller.backup();
      const url = URL.createObjectURL(new Blob([output.text], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = output.filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      controller.markBackupDownloaded(plan);
    } catch { setError("バックアップのダウンロードを開始できませんでした。ログイン状態を確認してください。"); }
  }
  return <section aria-label="優待DBの復元" style={{ border: "2px solid var(--color-border)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
    <h2>優待DBの復元（接続検証）</h2>
    <p>本人の8種類をファイルの状態へ置き換えます。ファイルにない行は削除対象です。他ユーザー・他ツール・旧端末データ・既存監査は変更しません。</p>
    <p>差分確認では変更前データをDB内へコピーして保全します。元の業務データは空にしません。復元APIが管理者により有効化されている環境だけで利用できます。</p>
    <label>復元用の優待DBファイル<input type="file" accept=".json,application/json" disabled={!editable} onChange={e => void select(e.target.files?.[0])} /></label>
    <label style={{ display: "block" }}>復元理由<textarea value={reason} maxLength={1000} disabled={!editable} onChange={e => setReason(e.target.value)} /></label>
    <button disabled={!editable || !text || !reason.trim()} onClick={() => { setConfirmed(false); void controller.preview(text, reason); }}>復元の差分を確認する</button>
    <hr />
    <label>保存したプランID<input value={planId} disabled={busy || state.appliedAttempt} onChange={e => setPlanId(e.target.value.trim())} placeholder="バックアップのファイル名に含まれるUUID" /></label>
    <button disabled={busy || !(state.planId || planId)} onClick={() => { setConfirmed(false); void controller.recover(state.planId || planId); }}>同じプランの結果を確認する</button>
    {state.planId && <p>復元プランID（控えてください）: <code>{state.planId}</code></p>}
    <p>再読み込み後は保存したプランIDで結果を取得できます。取得だけでは復元しません。ファイルや確認内容を端末ストレージへ自動保存しません。</p>
    {p && <div>
      <p>有効期限: {new Date(p.expires_at).toLocaleString("ja-JP")} {Date.parse(p.expires_at) <= now ? "（期限切れ）" : ""}</p>
      <p>revisionと更新日時も差分に含みます。古いrevisionへ戻さず、新しいrevisionを付けます。詳細は省略せず全行・全フィールドを表示します。</p>
      {collections.map(k => <details key={k}><summary>{collectionLabels[k]}: 追加 {p.changes[k].filter(c => c.action === "add").length} / 変更 {p.changes[k].filter(c => c.action === "change").length} / 削除 {p.changes[k].filter(c => c.action === "delete").length}</summary>
        {p.changes[k].map(c => <details key={c.id}><summary>{c.action === "add" ? "追加" : c.action === "delete" ? "削除" : "変更"}: {c.id}</summary>
          <p>変更前</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(c.before, null, 2)}</pre>
          <p>変更後</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(c.after, null, 2)}</pre></details>)}
      </details>)}
      <button disabled={busy} onClick={() => void download()}>変更前バックアップをダウンロード</button>
      <p>これは公開業務データのバックアップで、DB全体の物理バックアップではありません。個人情報を含むため安全に保管してください。</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy || !state.backupReady || state.status !== "preview"} onChange={e => setConfirmed(e.target.checked)} />ダウンロード先のバックアップと差分を確認し、削除対象を含めて復元することに同意します</label>
      <button disabled={busy || !confirmed || !state.backupReady || state.status !== "preview" || !state.appliedAttempt && Date.parse(p.expires_at) <= now}
        onClick={() => { if (window.confirm("表示した追加・変更・削除を実行します。変更前バックアップは残ります。このプランで復元しますか？")) void controller.apply(p.plan_id, confirmed); }}>確認した内容で復元する</button>
    </div>}
    {state.message && <p role={state.status === "uncertain" || state.status === "error" || state.status === "different" ? "alert" : "status"}>{state.message}</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && (!state.appliedAttempt || ["verified", "different"].includes(state.status)) && <button onClick={() => { controller.reset(); setConfirmed(false); setPlanId(""); setError(""); }}>確認を終了・やり直す</button>}
  </section>;
}
