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
  group: "investment" | "workspace";
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    href: "/premium/portfolio",
    icon: "📊",
    title: "保有銘柄分析",
    description: "保有・損益・配当・優待・直近の予定をまとめて確認します。",
    group: "investment",
  },
  {
    href: "/premium/market",
    icon: "📈",
    title: "業種モメンタム",
    description: "月内の業種モメンタムを、ヒートマップと業種比較チャートで読みます。",
    group: "investment",
  },
  {
    href: "/premium/themes",
    icon: "🧭",
    title: "テーマViewer",
    description: "ChatGPT + Supabaseで整備したテーマの概要・根拠・履歴を読み取り専用で確認します。",
    group: "investment",
  },
  {
    href: "/premium/industry-map",
    icon: "🗺",
    title: "業界マップ",
    description:
      "Supabaseに保存した産業構造・企業経済圏を、階層・放射・ネットワーク・マトリクス・表に切り替えて俯瞰します。",
    group: "investment",
  },
  {
    href: "/premium/company-network",
    icon: "🕸",
    title: "企業関係マップ",
    description:
      "出資・親子・歴史的関係と財閥・企業グループ所属を、根拠付きのネットワークとして確認します。",
    group: "investment",
  },
  {
    href: "/premium/theme-company-network",
    icon: "🔗",
    title: "テーマ × 企業関係",
    description:
      "テーマへの直接企業と、出資・支配などの企業関係で見つかる企業を分けて横断探索します。",
    group: "investment",
  },
  {
    href: "/premium/product-map/dashboard",
    icon: "▦",
    title: "Workspace Dashboard",
    description:
      "複数の個人開発Productを、状態・重要度・運用先・接続の観点から俯瞰し、次に見るべき対象を判断します。",
    group: "workspace",
  },
  {
    href: "/premium/product-map",
    icon: "🧩",
    title: "Product Map",
    description:
      "Workspace Coreに登録したProduct・Repository・Technology・Service・依存関係を、Product単位で根拠付き確認します。",
    group: "workspace",
  },
  {
    href: "/premium/routines",
    icon: "🗓",
    title: "ルーティン一覧",
    description: "自動・半自動・手動で回している定期作業を、週間タイムテーブルで棚卸しします。",
    group: "workspace",
  },
  {
    href: "/admin",
    icon: "⚙",
    title: "管理コンソール",
    description: "各データソースの最終更新日・スケジュール・SLA を一望します。",
    group: "workspace",
  },
];

const cardBaseStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
  padding: "22px 20px",
  borderRadius: 20,
  textDecoration: "none",
  minHeight: 150,
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
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    fontSize: 26,
                    lineHeight: 1,
                    background: "var(--color-accent-sub)",
                    border: "1px solid var(--color-border-accent)",
                  }}
                >
                  {card.icon}
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "var(--color-text)" }}>
                  {card.title}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-sub)" }}>
                  {card.description}
                </span>
                <span
                  style={{
                    marginTop: "auto",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--color-accent)",
                  }}
                >
                  開く →
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
