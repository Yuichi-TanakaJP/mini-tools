"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import { pullAll, pushAll } from "@/lib/sync/client";
import { track } from "@/lib/analytics";
import { validateNewPassword } from "@/lib/auth/password";

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

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

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
      setMessage("ログインしました。データ同期は必要なときに手動で保存または復元してください。");
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
        setMessage("登録してログインしました。データ同期は必要なときに手動で保存または復元してください。");
      } else {
        setMessage("確認メールを送信しました。メール内のリンクで認証してください。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!supabase) return;
    setForgotBusy(true);
    setForgotMessage(null);
    setForgotError(null);
    try {
      // Supabase は「メールアドレスが存在しない」ケースでは意図的に error を返さない仕様
      // （アカウント列挙対策）。一方、リダイレクトURL不許可・レート制限・通信失敗など
      // 送信処理そのものが失敗したケースでは error（または例外）が返る。
      // そのため error / 例外の有無だけを見て「送信できたか」を判定しても、
      // メールアドレスの存在有無は漏れない。
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/account/reset-password`,
      });
      if (error) {
        setForgotError("送信に失敗しました。しばらくしてからもう一度お試しください。");
        return;
      }
      track("action_clicked", { action: "auth_reset_password_request" });
      // 存在しないメールアドレスでも同じ文言にする（アカウント列挙防止）。
      setForgotMessage(
        "メールを送信しました。届いたリンクから新しいパスワードを設定してください。数分待っても届かない場合は迷惑メールフォルダもご確認ください。",
      );
    } catch {
      setForgotError("送信に失敗しました。しばらくしてからもう一度お試しください。");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!supabase) return;
    setChangeError(null);
    setChangeMessage(null);
    const check = validateNewPassword(newPassword, confirmPassword);
    if (!check.valid) {
      setChangeError(check.error ?? "入力内容を確認してください。");
      return;
    }
    setChangeBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setChangeError(error.message);
        return;
      }
      track("action_clicked", { action: "auth_change_password" });
      setNewPassword("");
      setConfirmPassword("");
      setChangeMessage("パスワードを変更しました。");
    } finally {
      setChangeBusy(false);
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
      if (res.ok) setMessage("この端末のデータをクラウドへ保存しました（空データは上書き防止のため送信しません）。");
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
        setMessage("クラウドから復元しました。上書き前のローカルデータは安全バックアップとしてこのブラウザ内に残しています。ページを再読み込みします…");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage("クラウド側に新しいデータはありませんでした。");
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
              ログイン直後に自動同期はしません。必要な操作を選んで実行してください。
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleUpload} style={primaryBtn} disabled={busy}>
                この端末を保存
              </button>
              <button onClick={handleRestore} style={subBtn} disabled={busy}>
                クラウドから復元
              </button>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>パスワードを変更</h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
              }}
            >
              新しいパスワードを入力してください。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                新しいパスワード
                <div style={{ position: "relative", marginTop: 6 }}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-pressed={showNewPassword}
                    aria-label={showNewPassword ? "パスワードを隠す" : "パスワードを表示"}
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
                    {showNewPassword ? "隠す" : "表示"}
                  </button>
                </div>
              </label>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                新しいパスワード（確認用）
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ ...inputStyle, marginTop: 6 }}
                />
              </label>
              <div>
                <button
                  onClick={handleChangePassword}
                  style={primaryBtn}
                  disabled={changeBusy || !newPassword || !confirmPassword}
                >
                  パスワードを変更
                </button>
              </div>
              {changeError && (
                <p style={{ fontSize: 13, color: "var(--color-danger, #dc2626)", margin: 0 }}>
                  {changeError}
                </p>
              )}
              {changeMessage && (
                <p style={{ fontSize: 13, color: "var(--color-accent)", margin: 0, lineHeight: 1.6 }}>
                  {changeMessage}
                </p>
              )}
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

            <div style={{ marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword((v) => !v);
                  setForgotMessage(null);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--color-accent)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                パスワードを忘れた場合
              </button>
            </div>

            {showForgotPassword && (
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 12,
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  登録済みのメールアドレス
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={subBtn}
                    disabled={forgotBusy || !forgotEmail}
                  >
                    リセットメールを送信
                  </button>
                </div>
                {forgotError && (
                  <p style={{ fontSize: 13, color: "var(--color-danger, #dc2626)", margin: 0, lineHeight: 1.6 }}>
                    {forgotError}
                  </p>
                )}
                {forgotMessage && (
                  <p style={{ fontSize: 13, color: "var(--color-accent)", margin: 0, lineHeight: 1.6 }}>
                    {forgotMessage}
                  </p>
                )}
              </div>
            )}
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
        ※ 同期は任意です。ログインしただけでは端末データをサーバーへ送信しません。保存または復元を選んだときだけ、サーバー（Supabase）と通信します。
        未ログインなら一切サーバーへ送信されません。
      </p>
    </main>
  );
}
