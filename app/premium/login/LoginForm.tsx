"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function getSafeNextPath(rawNextPath: string | null) {
  if (!rawNextPath) return "/premium";
  if (!rawNextPath.startsWith("/premium")) return "/premium";
  if (rawNextPath.startsWith("//")) return "/premium";
  if (rawNextPath.includes("\\") || rawNextPath.includes("\r") || rawNextPath.includes("\n")) {
    return "/premium";
  }
  return rawNextPath;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "ログインに失敗しました。");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
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
          {error}
        </div>
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
