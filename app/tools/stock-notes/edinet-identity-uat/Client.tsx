"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  EDINET_IDENTITY_UAT,
  edinetIdentityUatUrl,
  inspectEdinetIdentityUatPacket,
} from "@/lib/edinet-identity-uat";

type Result = {
  requestedAt: string;
  httpStatus: number;
  responseSha256: string;
  packetPrecheck: boolean;
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function Client() {
  const attempted = useRef(false);
  const rawResponse = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOnce() {
    if (attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("本人ログインを確認できません。アカウント画面でログインしてください。");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session?.access_token || session.user.id !== userData.user.id) {
        throw new Error("本人セッションを確認できません。再ログインしてください。");
      }
      const { url, anonKey } = getSupabaseEnv();
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
      const raw = await response.text();
      const responseSha256 = await sha256Hex(raw);
      let packetPrecheck = false;
      if (response.status === 200) {
        try {
          packetPrecheck = inspectEdinetIdentityUatPacket(JSON.parse(raw), userData.user.id);
        } catch {
          // Keep the exact raw response for the independent validator.
        }
        rawResponse.current = raw;
      }
      setResult({ requestedAt, httpStatus: response.status, responseSha256, packetPrecheck });
    } catch (caught) {
      setError(caught instanceof Error && caught.message.startsWith("本人")
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
