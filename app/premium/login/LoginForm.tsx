"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSafePremiumNextPath } from "@/lib/premium-navigation";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = getSafePremiumNextPath(searchParams.get("next"));

  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; kind: "auth" | "config" | "network" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/premium/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; code?: string };
        const kind = data.code === "not_configured" ? "config" : "auth";
        setError({ message: data.error ?? "ログインに失敗しました。", kind });
        setIsSubmitting(false);
        return;
      }

      // フルナビゲーションで遷移する。
      // router.push + router.refresh の組み合わせだと、新しい cookie が App Router の
      // Server Router Cache に反映される前にナビゲーションが走り、最初の遷移で
      // 「未認証扱い → /premium/login にリダイレクト」になることがあった (要 2 回クリック)。
      // window.location.assign なら次のリクエストで cookie が確実に送られ 1 クリックで完了する。
      // 遷移するので isSubmitting はそのまま (ボタンを無効化のまま) にする。
      window.location.assign(nextPath);
    } catch {
      setError({ message: "通信に失敗しました。時間をおいて再度お試しください。", kind: "network" });
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <label
        htmlFor="premium-password"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--color-text-sub)",
        }}
      >
        パスワード
      </label>
      <input
        id="premium-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        placeholder="パスワードを入力"
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 14,
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-bg-input)",
          fontSize: 15,
          color: "var(--color-text)",
        }}
      />

      {error ? (
        error.kind === "config" ? (
          <div
            style={{
              borderRadius: 12,
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#78350f",
              padding: "12px 14px",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>⚙ サーバー設定が未完了</div>
            <div>{error.message}</div>
          </div>
        ) : (
          <div
            style={{
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {error.message}
          </div>
        )
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !password}
        style={{
          height: 48,
          border: "none",
          borderRadius: 14,
          background: isSubmitting || !password
            ? "#9db0ff"
            : "linear-gradient(135deg, #1d44d8 0%, #2554ff 60%, #6ea8fe 100%)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          cursor: isSubmitting || !password ? "default" : "pointer",
          boxShadow: "0 12px 30px rgba(37, 84, 255, 0.24)",
        }}
      >
        {isSubmitting ? "確認中..." : "Premium に入る"}
      </button>
    </form>
  );
}
