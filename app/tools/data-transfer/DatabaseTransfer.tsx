"use client";

import { useEffect, useRef, useState } from "react";
import { getYutaiRepository, useYutaiWorkspace } from "@/lib/yutai/browser";
import { getSessionActionRunner } from "@/lib/yutai/action-runner";
import { getSupabaseEnv, isSyncConfigured } from "@/lib/supabase/config";
import { collectionLabels, collections, compareWorkspaceExport, freshWorkspaceExport, MAX_EXPORT_BYTES, parseWorkspaceExport, type WorkspaceExport } from "@/lib/yutai/transfer";
import { YutaiFailure, type ViewState } from "@/lib/yutai/repository";
import DatabaseRestore from "./DatabaseRestore";

const panel = { padding: 16, marginBottom: 24, border: "1px solid var(--color-border)", borderRadius: 12 };
export default function DatabaseTransfer() {
  const configured = isSyncConfigured(), view = useYutaiWorkspace(1, configured);
  if (!configured || !view.data) return <section style={panel} aria-label="優待DBの出力・照合"><h2>優待DBの出力・照合</h2>
    <p>{!configured ? "DB接続設定がありません。旧データへは戻しません。" : view.status === "signed_out" ? "Supabaseへのログインが必要です。" : "優待データを取得しています。"}</p>
    {view.error && <p role="alert">DBから取得できませんでした。通信・ログイン状態を確認してください。</p>}
    <a href="/account">ログイン画面へ</a> <button onClick={() => window.location.reload()}>再読み込み</button></section>;
  return <div key={view.sessionRevision}><ConnectedTransfer view={view} />
    {process.env.NEXT_PUBLIC_YUTAI_RESTORE_DB_PREVIEW === "true" && <DatabaseRestore />}</div>;
}
function ConnectedTransfer({ view }: { view: ViewState }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [file, setFile] = useState<WorkspaceExport | null>(null);
  const [result, setResult] = useState<ReturnType<typeof compareWorkspaceExport> | null>(null);
  const [comparedAt, setComparedAt] = useState("");
  const locked = useRef(false), alive = useRef(true), loadSequence = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const repo = getYutaiRepository();
  const assertIdle = () => {
    const status = getSessionActionRunner(repo, view.sessionRevision).getSnapshot().status;
    if (status === "running" || status === "paused") throw new Error("優待データの保存が未完了です。元の画面で保存結果を確定してから実行してください。");
  };
  const current = () => freshWorkspaceExport(repo, getSupabaseEnv().url, view.sessionRevision, assertIdle);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(""); setError("");
    try { await action(); } catch (cause) {
      if (alive.current) setError(cause instanceof YutaiFailure
        ? "DBの再取得に失敗しました。通信・ログイン状態を確認して再実行してください。ファイルの出力・DBへの書き込みは行っていません。"
        : cause instanceof Error ? cause.message : "処理を完了できませんでした。");
    }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  function download() {
    void run(async () => {
      const output = await current();
      const text = JSON.stringify(output);
      // Prove the actual download bytes can be read back, not just the in-memory object.
      await parseWorkspaceExport(text);
      if (!alive.current || repo.getIdentity().sessionRevision !== view.sessionRevision) return;
      assertIdle();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url;
      a.download = `mini-tools-yutai-db-${output.exported_at.replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`DBを再取得し、${collections.reduce((sum, name) => sum + output.workspace[name].length, 0)}件の出力ファイルを作成しました。端末のダウンロード先を確認してください。`);
    });
  }
  async function selectFile(selected: File | undefined) {
    const sequence = ++loadSequence.current;
    setFile(null); setResult(null); setError(""); setMessage("");
    if (!selected) return;
    try {
      if (selected.size > MAX_EXPORT_BYTES) throw new Error("ファイルが10MBを超えています。");
      const parsed = await parseWorkspaceExport(await selected.text());
      if (!alive.current || sequence !== loadSequence.current) return;
      setFile(parsed);
    } catch (cause) { if (alive.current && sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : "ファイルを読み込めません。"); }
  }
  function compare() {
    if (!file) return;
    setResult(null);
    void run(async () => {
      const latest = await current();
      const report = compareWorkspaceExport(file, latest.workspace, latest.source);
      if (!alive.current || repo.getIdentity().sessionRevision !== view.sessionRevision) return;
      setResult(report); setComparedAt(latest.fetched_at);
      setMessage(report.every(r => !r.fileOnly.length && !r.currentOnly.length && !r.changed.length)
        ? "全8種類のデータが一致しました。DBへの書き込みは行っていません。"
        : "差分があります。照合のみで、DBへの書き込みは行っていません。");
    });
  }
  return <section style={panel} aria-label="優待DBの出力・照合"><h2>優待DBの出力・照合（接続検証）</h2>
    <p>本人のメモ・全月設定・全年履歴・タグ・残高・選択をDBから出力します。下の端末内バックアップとは別形式です。</p>
    <p>これは現在の業務データの出力です。削除済みデータ・操作監査・移行管理情報・認証設定を含むDB全体のバックアップではありません。</p>
    <p>ファイルには個人のメモ等が含まれます。安全な場所に保管し、公開しないでください。チェックサムは破損検知用で、作成者の証明ではありません。</p>
    <p>最終取得: {new Date(view.fetchedAt!).toLocaleString("ja-JP")}{view.stale ? "（再取得が必要）" : ""}</p>
    {view.error && <p role="alert">現在のデータ取得に失敗しています。古いキャッシュを最新として出力しません。</p>}
    <button type="button" disabled={busy} onClick={download}>DB全件JSONをダウンロード</button>
    <p>出力前にDBを再取得します。未確定の保存・通信失敗・ログイン変更があれば出力を中止します。</p>
    <label>優待DBファイルを読み込む（照合のみ）<input type="file" accept="application/json,.json" disabled={busy} onChange={e => void selectFile(e.target.files?.[0])} /></label>
    {file && <div><p>ファイル出力日時: {file.exported_at}</p>
      <p>チェックサム検証済み。{collections.map(c => `${collectionLabels[c]} ${file.workspace[c].length}件`).join(" / ")}</p>
      <button type="button" disabled={busy} onClick={compare}>現在のDBと全件照合</button>
    </div>}
    {busy && <p role="status">取得・検証しています…</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {result && <div style={{ overflowX: "auto" }}><p>照合時点: {comparedAt}。この後の変更は「全件照合」で再確認してください。</p>
      <table><thead><tr>{["種類", "ファイル", "現在DB", "一致", "ファイルのみ", "DBのみ", "内容変更"].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{result.map(r => <tr key={r.collection}><th>{collectionLabels[r.collection]}</th><td>{r.fileCount}</td><td>{r.currentCount}</td><td>{r.equal}</td><td>{r.fileOnly.length}</td><td>{r.currentOnly.length}</td><td>{r.changed.length}</td></tr>)}</tbody></table>
      {result.filter(r => r.fileOnly.length || r.currentOnly.length || r.changed.length).map(r => <details key={r.collection}><summary>{collectionLabels[r.collection]}の差分ID</summary>
        <p>各一覧は先頭20件まで表示。上の件数は全件の照合結果です。</p>
        <p>ファイルのみ: {r.fileOnly.slice(0, 20).join(", ") || "なし"}</p><p>DBのみ: {r.currentOnly.slice(0, 20).join(", ") || "なし"}</p><p>内容変更: {r.changed.slice(0, 20).join(", ") || "なし"}</p>
      </details>)}</div>}
    <p>この欄は照合専用です。復元は別の確認欄から明示実行し、旧形式のインポートは行いません。</p>
  </section>;
}
