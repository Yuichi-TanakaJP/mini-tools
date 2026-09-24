"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  EDINET_IDENTITY_UAT,
  canRunEdinetIdentityUat,
  edinetIdentityUatUrl,
  readEdinetIdentityUatResponse,
} from "@/lib/edinet-identity-uat";

type Result = {
  requestedAt: string;
  httpStatus: number;
  responseSha256: string;
  packetPrecheck: boolean;
};

export default function Client() {
  const attempted = useRef(false);
  const rawResponse = useRef<ArrayBuffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOnce() {
    if (attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const { url, anonKey } = getSupabaseEnv();
      if (!canRunEdinetIdentityUat(window.location.origin, process.env.EDINET_IDENTITY_UAT_DEPLOY_ENV, url)) {
        throw new Error("UATは指定した本番URLでのみ実行できます。");
      }
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("本人ログインを確認できません。アカウント画面でログインしてください。");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session?.access_token || session.user.id !== userData.user.id) {
        throw new Error("本人セッションを確認できません。再ログインしてください。");
      }
      const requestedAt = new Date().toISOString();
      const response = await fetch(edinetIdentityUatUrl(url), {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
      });
      const observed = await readEdinetIdentityUatResponse(response, userData.user.id);
      rawResponse.current = observed.rawResponse;
      setResult({ requestedAt, httpStatus: observed.httpStatus,
        responseSha256: observed.responseSha256, packetPrecheck: observed.packetPrecheck });
    } catch (caught) {
      setError(caught instanceof Error && (caught.message.startsWith("本人") || caught.message.startsWith("UATは"))
        ? caught.message
        : "GETを完了できませんでした。通信・認証状態を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  function downloadRawResponse() {
    if (!rawResponse.current) return;
    const blob = new Blob([rawResponse.current], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `edinet-identity-${EDINET_IDENTITY_UAT.docId}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: 20 }}>
      <h1>EDINET identity 1件限定UAT</h1>
      <p>対象: {EDINET_IDENTITY_UAT.docId} / EDINET {EDINET_IDENTITY_UAT.sourceSecCode} → JPX {EDINET_IDENTITY_UAT.matchedJpxCode}</p>
      <p>ログイン中の本人として、読み取り専用RPCをGETで1回呼びます。JWTと生レスポンスは画面やログに表示しません。</p>
      <button type="button" onClick={runOnce} disabled={busy || attempted.current}>
        {busy ? "確認中…" : "1件だけGETする"}
      </button>
      {error && <p role="alert">{error} この画面では再試行せず、原因を確認してください。</p>}
      {result && (
        <section aria-label="UAT結果">
          <p>要求時刻 (UTC): {result.requestedAt}</p>
          <p>HTTP status: {result.httpStatus}</p>
          <p>生レスポンス SHA-256: <code>{result.responseSha256}</code></p>
          <p>packet事前チェック: {result.packetPrecheck ? "通過" : "不通過"}</p>
          <p>事前チェックだけではUAT合格になりません。生レスポンスをStock Notesの完全validatorで確認してください。</p>
          {rawResponse.current && (
            <button type="button" onClick={downloadRawResponse}>生レスポンスをローカルに保存</button>
          )}
        </section>
      )}
    </main>
  );
}
