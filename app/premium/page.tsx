import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const metadata: Metadata = {
  title: "Premium ホーム | mini-tools",
  description: "mini-tools premium のホーム。各 premium 機能への入口です。",
  alternates: {
    canonical: "/premium",
  },
};

type FeatureCard = {
  href: string;
  icon: string;
  title: string;
  description: string;
  tone: "blue" | "amber" | "slate";
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    href: "/premium/portfolio",
    icon: "📊",
    title: "保有銘柄ダッシュボード",
    description: "保有・損益・配当・優待・直近の予定をまとめて確認します。",
    tone: "blue",
  },
  {
    href: "/premium/market",
    icon: "📈",
    title: "業種トレンド（TOPIX33）",
    description: "月内の業種モメンタムを、ヒートマップと業種比較チャートで読みます。",
    tone: "amber",
  },
  {
    href: "/admin",
    icon: "⚙",
    title: "管理コンソール",
    description: "各データソースの最終更新日・スケジュール・SLA を一望します。",
    tone: "slate",
  },
];

const TONE_MAP: Record<FeatureCard["tone"], { bg: string; border: string; fg: string }> = {
  blue: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" },
  amber: { bg: "#fff7ed", border: "#fdba74", fg: "#c2410c" },
  slate: { bg: "#f8fafc", border: "#cbd5e1", fg: "#334155" },
};

const cardBaseStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
  padding: "22px 20px",
  borderRadius: 20,
  textDecoration: "none",
  minHeight: 150,
};

export default async function PremiumHomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium")}`);
  }

  return (
    <main style={{ padding: "32px 16px 72px" }}>
      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at top left, rgba(250, 204, 21, 0.30), transparent 30%), radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.22), transparent 34%), linear-gradient(135deg, #0f172a 0%, #172554 48%, #1d4ed8 100%)",
            color: "#fff",
            borderRadius: 30,
            padding: "30px 24px",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 700 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  marginBottom: 14,
                }}
              >
                Premium ホーム
              </div>
              <h1 style={{ margin: "0 0 12px", fontSize: 34, lineHeight: 1.1, letterSpacing: -1 }}>
                おかえりなさい
              </h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "rgba(255,255,255,0.82)" }}>
                premium 機能の入口です。使いたい機能をカードから選んでください。
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURE_CARDS.map((card) => {
            const tone = TONE_MAP[card.tone];
            return (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  ...cardBaseStyle,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.fg,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>{card.icon}</span>
                <span style={{ fontSize: 18, fontWeight: 900 }}>{card.title}</span>
                <span style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-sub)" }}>
                  {card.description}
                </span>
                <span style={{ marginTop: "auto", fontSize: 13, fontWeight: 800 }}>開く →</span>
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              background: "#fff",
              color: "var(--color-text-sub)",
              border: "1px solid var(--color-border)",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            公開ツール一覧へ
          </Link>
        </div>
      </section>
    </main>
  );
}
