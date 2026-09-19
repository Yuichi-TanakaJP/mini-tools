"use client";
import { useRef, useState } from "react";

/** Existing premium-protected request endpoint; never sends memo content. */
export function DatabaseShortBalance({ codes, asOf, blocked }: { codes: string[]; asOf: string | null; blocked: boolean }) {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const visible = [...new Set(codes.map(c => c.trim().toUpperCase()).filter(c => /^[0-9][0-9A-Z]{3}$/.test(c)))];
  async function request() {
    if (busy.current || blocked || visible.length === 0 || visible.length > 100) return;
    busy.current = true; setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/nikko/short-balance", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: visible }), signal: AbortSignal.timeout(15_000) });
      const result = await response.json();
      if (!response.ok || result.accepted !== true || result.requested !== visible.length) {
        setMessage("取得依頼を確認できませんでした。premiumログイン状態と通信を確認してください。"); return;
      }
      setMessage(`${result.requested}件の取得依頼を受け付けました。残高取得の完了ではありません。後ほどページを再読み込みしてください。`);
    } catch { setMessage("取得依頼の結果を確認できませんでした。自動再送はしていません。"); }
    finally { busy.current = false; setLoading(false); }
  }
  return <section aria-label="信用情報取得">
    <p>信用売り残高の基準日: {asOf ?? "未取得"}（公開市場データ）。表示中の銘柄コードだけを取得依頼します。premiumログインが必要です。</p>
    <button type="button" disabled={blocked || loading || visible.length === 0 || visible.length > 100} onClick={request}>信用情報を取得依頼（{visible.length}件）</button>
    {visible.length > 100 && <p>1回100銘柄までです。月・タグ・検索で絞り込んでください。</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
