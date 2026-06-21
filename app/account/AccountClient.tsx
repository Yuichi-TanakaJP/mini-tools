"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import { pullAll, pushAll } from "@/lib/sync/client";
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

export default function AccountClient() {
  const configured = isSyncConfigured();
  const [supabase] = useState<SupabaseClient | null>(() =>
    configured ? createSupabaseBrowserClient() : null,
  );

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [inputEmail, setInputEmail] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ログイン直後の同期: まずサーバーから復元（新しい方）、次にローカルを送信。
  // 復元で変化があればページを再読み込みして各ツールに反映する。
  async function syncOnLogin() {
    const pulled = await pullAll();
    await pushAll();
    if (pulled.ok && pulled.changed.length > 0) {
      window.location.reload();
    }
  }

  async function handleLogin() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: inputEmail.trim(),
        password: inputPassword,
      });
      if (error) {
        setError(error.message);
        return;
      }
      track("action_clicked", { action: "auth_login" });
      setInputPassword("");
      await syncOnLogin();
      setMessage("ログインしました。データを同期しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: inputEmail.trim(),
        password: inputPassword,
      });
      if (error) {
        setError(error.message);
        return;
      }
      track("action_clicked", { action: "auth_signup" });
      setInputPassword("");
      if (data.session) {
        // メール確認 OFF の場合はそのままログイン状態になる。
        await syncOnLogin();
        setMessage("登録してログインしました。データを同期しました。");
      } else {
        setMessage("確認メールを送信しました。メール内のリンクで認証してください。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setEmail(null);
    setMessage("ログアウトしました（端末内のデータはそのまま残ります）。");
  }

  async function handleUpload() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await pushAll();
      if (res.ok) setMessage("このデバイスのデータをサーバーへ保存しました。");
      else setError(res.error ?? "アップロードに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await pullAll();
      if (!res.ok) {
        setError(res.error ?? "復元に失敗しました。");
        return;
      }
      if (res.changed.length > 0) {
        setMessage("サーバーから復元しました。ページを再読み込みします…");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage("サーバー側に新しいデータはありませんでした。");
      }
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
          ログインして端末間で同期
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-sub)" }}>
          任意機能です。ログインすると対応ツール（まずは優待メモ帳）のデータを端末間で同期できます。
          未ログインなら従来どおり端末内のみで動きます。
        </p>
      </div>

      {!configured ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-sub)" }}>
            同期機能は現在この環境では無効です（サーバー未設定）。従来どおり各ツールは端末内で利用できます。
          </p>
        </div>
      ) : !ready ? (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>読み込み中…</p>
        </div>
      ) : email ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
              ログイン中
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{email}</div>
            <button onClick={handleLogout} style={subBtn} disabled={busy}>
              ログアウト
            </button>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>同期</h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
              }}
            >
              ログイン時に自動で同期されます。手動で実行することもできます。
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleUpload} style={primaryBtn} disabled={busy}>
                このデバイスを保存（アップロード）
              </button>
              <button onClick={handleRestore} style={subBtn} disabled={busy}>
                サーバーから復元
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              メールアドレス
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                autoComplete="email"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              パスワード
              <div style={{ position: "relative", marginTop: 6 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  autoComplete="current-password"
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
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={handleLogin} style={primaryBtn} disabled={busy || !inputEmail || !inputPassword}>
                ログイン
              </button>
              <button onClick={handleSignup} style={subBtn} disabled={busy || !inputEmail || !inputPassword}>
                新規登録
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "var(--color-danger, #dc2626)", marginTop: 14 }}>{error}</p>
      )}
      {message && (
        <p style={{ fontSize: 13, color: "var(--color-accent)", marginTop: 14, lineHeight: 1.6 }}>
          {message}
        </p>
      )}

      <p style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.7, marginTop: 24 }}>
        ※ 同期は任意です。ログインしたデータはサーバー（Supabase）に保存され、あなたのアカウントだけが読み書きできます。
        未ログインなら一切サーバーへ送信されません。
      </p>
    </main>
  );
}
