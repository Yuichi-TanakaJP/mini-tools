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
  short: string;
  group: "investment" | "workspace";
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    href: "/premium/portfolio",
    icon: "📊",
    title: "保有銘柄分析",
    short: "保有・損益・方針を横断確認",
    group: "investment",
  },
  {
    href: "/premium/market",
    icon: "📈",
    title: "業種モメンタム",
    short: "月内の業種トレンドを比較",
    group: "investment",
  },
  {
    href: "/premium/themes",
    icon: "🧭",
    title: "テーマViewer",
    short: "投資テーマの概要・根拠・履歴",
    group: "investment",
  },
  {
    href: "/premium/industry-map",
    icon: "🗺",
    title: "業界マップ",
    short: "産業構造と企業経済圏を俯瞰",
    group: "investment",
  },
  {
    href: "/premium/company-network",
    icon: "🕸",
    title: "企業関係マップ",
    short: "出資・親子・企業グループを確認",
    group: "investment",
  },
  {
    href: "/premium/theme-company-network",
    icon: "🔗",
    title: "テーマ × 企業関係",
    short: "テーマと企業関係を横断探索",
    group: "investment",
  },
  {
    href: "/premium/product-map/dashboard",
    icon: "▦",
    title: "Workspace Dashboard",
    short: "個人開発Productの状態を俯瞰",
    group: "workspace",
  },
  {
    href: "/premium/product-map",
    icon: "🧩",
    title: "Product Map",
    short: "ProductとRepositoryの関係を確認",
    group: "workspace",
  },
  {
    href: "/premium/routines",
    icon: "🗓",
    title: "ルーティン一覧",
    short: "定期作業を週間で棚卸し",
    group: "workspace",
  },
  {
    href: "/admin",
    icon: "⚙",
    title: "管理コンソール",
    short: "更新状況・スケジュール・SLA",
    group: "workspace",
  },
];

const cardBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 14px",
  borderRadius: 18,
  textDecoration: "none",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  boxShadow: "var(--shadow-card)",
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
              "radial-gradient(circle at top left, color-mix(in srgb, var(--color-warning-solid) 18%, transparent), transparent 32%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-accent) 34%, transparent), transparent 42%), var(--color-bg-emphasis)",
            color: "var(--color-text-on-emphasis)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 30,
            padding: "30px 24px",
            boxShadow: "var(--shadow-panel)",
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
                  background:
                    "color-mix(in srgb, var(--color-text-on-emphasis) 12%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-text-on-emphasis) 16%, transparent)",
                  marginBottom: 14,
                }}
              >
                PREMIUM
              </div>
              <h1 style={{ margin: "0 0 12px", fontSize: 34, lineHeight: 1.1, letterSpacing: -1 }}>
                分析と管理を、ひとつに。
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.9,
                  color:
                    "color-mix(in srgb, var(--color-text-on-emphasis) 82%, transparent)",
                }}
              >
                保有銘柄から開発環境まで、必要な視点を選べます。
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>

        {([
          { key: "investment", label: "投資分析" },
          { key: "workspace", label: "Workspace" },
        ] as const).map((section) => (
          <section key={section.key} aria-labelledby={`premium-${section.key}`}>
            <h2
              id={`premium-${section.key}`}
              style={{
                margin: "8px 0 12px",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.8,
                color: "var(--color-text-muted)",
                textTransform: section.key === "workspace" ? "uppercase" : undefined,
              }}
            >
              {section.label}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {FEATURE_CARDS.filter((card) => card.group === section.key).map((card) => {
                return (
                  <Link
                key={card.href}
                href={card.href}
                style={{
                  ...cardBaseStyle,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    fontSize: 22,
                    lineHeight: 1,
                    background: "var(--color-accent-sub)",
                    border: "1px solid var(--color-border-accent)",
                  }}
                >
                  {card.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: "var(--color-text)", marginBottom: 4 }}>
                    {card.title}
                  </span>
                  <span style={{ display: "block", fontSize: 12, lineHeight: 1.55, color: "var(--color-text-muted)" }}>
                    {card.short}
                  </span>
                </span>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 16, color: "var(--color-text-muted)", opacity: 0.45 }}>
                  →
                </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

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
              background: "var(--color-bg-card)",
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
