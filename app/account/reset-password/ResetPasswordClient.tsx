"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import { parseResetTokensFromUrl, validateNewPassword } from "@/lib/auth/password";
import { track } from "@/lib/analytics";

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  borderRadius: 18,
  border: "1px solid var(--color-border)",
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  padding: "18px 18px 16px",
};
const primaryBtn: React.CSSProperties = {
  padding: "11px 16px",
  border: "none",
  borderRadius: 12,
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
const subBtn: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 12,
  background: "var(--color-bg-input)",
  color: "var(--color-text-sub)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 10,
  background: "var(--color-bg-input)",
  color: "var(--color-text)",
  fontSize: 14,
  boxSizing: "border-box",
};

type Stage =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "done" }
  | { kind: "no-token" }
  | { kind: "expired" }
  | { kind: "session-error"; message: string };

export default function ResetPasswordClient() {
  const configured = isSyncConfigured();
  const [supabase] = useState<SupabaseClient | null>(() =>
    configured ? createSupabaseBrowserClient() : null,
  );

  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    async function establishSession() {
      const parsed = parseResetTokensFromUrl(window.location.search, window.location.hash);

      // どの経路でセッションを確立しても、トークンを URL 履歴から消す（漏洩防止）。
      const clearUrl = () => {
        window.history.replaceState({}, "", window.location.pathname);
      };

      if (parsed.kind === "error") {
        clearUrl();
        if (!active) return;
        if (parsed.errorCode === "otp_expired") {
          setStage({ kind: "expired" });
        } else {
          setStage({
            kind: "session-error",
            message: parsed.errorDescription || "リンクが無効です。もう一度リセットを申請してください。",
          });
        }
        return;
      }

      if (parsed.kind === "code") {
        const { error } = await supabase!.auth.exchangeCodeForSession(parsed.code);
        clearUrl();
        if (!active) return;
        if (error) {
          setStage(
            /expired|invalid/i.test(error.message)
              ? { kind: "expired" }
              : { kind: "session-error", message: error.message },
          );
          return;
        }
        setStage({ kind: "ready" });
        return;
      }

      if (parsed.kind === "token_hash") {
        const { error } = await supabase!.auth.verifyOtp({
          token_hash: parsed.tokenHash,
          type: parsed.type as "recovery",
        });
        clearUrl();
        if (!active) return;
        if (error) {
          setStage(
            /expired|invalid/i.test(error.message)
              ? { kind: "expired" }
              : { kind: "session-error", message: error.message },
          );
          return;
        }
        setStage({ kind: "ready" });
        return;
      }

      if (parsed.kind === "access_token") {
        const { error } = await supabase!.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        clearUrl();
        if (!active) return;
        if (error) {
          setStage(
            /expired|invalid/i.test(error.message)
              ? { kind: "expired" }
              : { kind: "session-error", message: error.message },
          );
          return;
        }
        setStage({ kind: "ready" });
        return;
      }

      // トークンが URL に無い場合、detectSessionInUrl が既にセッションを確立しているかもしれない
      // （@supabase/ssr のデフォルト挙動）ので、念のため既存セッションの有無を確認する。
      const { data } = await supabase!.auth.getSession();
      if (!active) return;
      setStage(data.session ? { kind: "ready" } : { kind: "no-token" });
    }

    establishSession();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit() {
    if (!supabase) return;
    setFormError(null);
    const check = validateNewPassword(newPassword, confirmPassword);
    if (!check.valid) {
      setFormError(check.error ?? "入力内容を確認してください。");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setFormError(error.message);
        return;
      }
      track("action_clicked", { action: "auth_reset_password_complete" });
      setNewPassword("");
      setConfirmPassword("");
      setStage({ kind: "done" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--color-accent-sub)",
            color: "var(--color-accent)",
            fontSize: 11,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          🔐 アカウント・同期
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.4 }}>
          新しいパスワードを設定
        </h1>
      </div>

      {!configured ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-sub)" }}>
            同期機能は現在この環境では無効です（サーバー未設定）。
          </p>
        </div>
      ) : stage.kind === "loading" ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>確認中…</p>
        </div>
      ) : stage.kind === "no-token" ? (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.7 }}>
            このページはリセットメールのリンクから開いてください。
          </p>
          <Link href="/account" style={{ ...subBtn, display: "inline-block", textDecoration: "none" }}>
            アカウントページへ戻る
          </Link>
        </div>
      ) : stage.kind === "expired" ? (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.7 }}>
            リンクの有効期限が切れています。もう一度リセットを申請してください。
          </p>
          <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
            アカウントページでリセットを申請
          </Link>
        </div>
      ) : stage.kind === "session-error" ? (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.7, color: "var(--color-danger, #dc2626)" }}>
            {stage.message}
          </p>
          <Link href="/account" style={{ ...subBtn, display: "inline-block", textDecoration: "none" }}>
            アカウントページへ戻る
          </Link>
        </div>
      ) : stage.kind === "done" ? (
        <div style={card}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.7 }}>パスワードを変更しました。</p>
          <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
            アカウントページへ
          </Link>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              新しいパスワード
              <div style={{ position: "relative", marginTop: 6 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 64 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-muted)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "4px 6px",
                  }}
                >
                  {showPassword ? "隠す" : "表示"}
                </button>
              </div>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              新しいパスワード（確認用）
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>
            <div style={{ marginTop: 4 }}>
              <button
                onClick={handleSubmit}
                style={primaryBtn}
                disabled={busy || !newPassword || !confirmPassword}
              >
                パスワードを変更
              </button>
            </div>
            {formError && (
              <p style={{ fontSize: 13, color: "var(--color-danger, #dc2626)", margin: 0 }}>{formError}</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
