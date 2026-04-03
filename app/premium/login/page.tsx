import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const metadata: Metadata = {
  title: "Premium Login (開発中) | mini-tools",
  description: "mini-tools premium 開発中ログイン画面です。",
  alternates: {
    canonical: "/premium/login",
  },
};

export default async function PremiumLoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (verifyPremiumSession(session)) {
    redirect("/premium");
  }

  return (
    <main style={{ padding: "40px 16px 72px" }}>
      <section
        style={{
          maxWidth: 540,
          margin: "0 auto",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          borderRadius: 28,
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
          padding: "28px 22px",
        }}
        >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            borderRadius: 999,
            background: "#fff7ed",
            color: "#c2410c",
            border: "1px solid #fdba74",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.3,
            marginBottom: 14,
          }}
        >
          Premium 開発中
        </div>

        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, #f59e0b 0%, #facc15 100%)",
            color: "#fff",
            boxShadow: "0 16px 32px rgba(245, 158, 11, 0.28)",
            marginBottom: 18,
            fontSize: 22,
          }}
        >
          👑
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 30,
            lineHeight: 1.15,
            letterSpacing: -0.8,
          }}
        >
          Premium Login
          <span style={{ display: "block", fontSize: 15, color: "#c2410c", marginTop: 8 }}>
            開発中の仮ログイン画面
          </span>
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            color: "var(--color-text-muted)",
            fontSize: 14,
            lineHeight: 1.8,
          }}
        >
          ここは本実装前の確認用ページです。いまは仮パスワードで premium 用の確認ページへ進めます。
        </p>

        <LoginForm />
      </section>
    </main>
  );
}
