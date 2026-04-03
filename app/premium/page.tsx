import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const metadata: Metadata = {
  title: "Premium Preview | mini-tools",
  description: "mini-tools premium の仮ランディングページです。",
  alternates: {
    canonical: "/premium",
  },
};

const ideaCards = [
  {
    title: "月間ヒートマップ",
    detail:
      "営業日 × 33業種で、どのタイミングで強弱が広がったかを色で俯瞰します。",
  },
  {
    title: "業種選択チャート",
    detail:
      "上位3 + 下位3を初期表示にしつつ、比較したい業種だけ折れ線で追える形にします。",
  },
  {
    title: "モメンタム要約",
    detail:
      "単日ランキングではなく、継続して強い業種や直近で反転した業種を短く要約します。",
  },
];

export default async function PremiumPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect("/premium/login?next=/premium");
  }

  return (
    <main style={{ padding: "32px 16px 72px" }}>
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at top left, rgba(250, 204, 21, 0.28), transparent 34%), linear-gradient(135deg, #0f172a 0%, #172554 45%, #1d4ed8 100%)",
            color: "#fff",
            borderRadius: 30,
            padding: "28px 24px",
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
            <div style={{ maxWidth: 620 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  marginBottom: 14,
                }}
              >
                Premium Preview / 仮ページ
              </div>
              <h1
                style={{
                  margin: "0 0 12px",
                  fontSize: 34,
                  lineHeight: 1.08,
                  letterSpacing: -1,
                }}
              >
                Premium の仮ページです
                <br />
                TOPIX33 の月間トレンドを
                <br />
                ここから育てていきます
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.9,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                ログイン後はいったんこの仮ランディングページへ入るようにしています。
                次はこの導線を起点に、ヒートマップや業種比較チャートを段階的に実装していく想定です。
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {ideaCards.map((card) => (
            <section
              key={card.title}
              style={{
                background: "var(--color-bg-card)",
                borderRadius: 22,
                border: "1px solid var(--color-border)",
                padding: "20px 18px",
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{card.title}</h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-muted)",
                  fontSize: 14,
                  lineHeight: 1.8,
                }}
              >
                {card.detail}
              </p>
            </section>
          ))}
        </div>

        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 24,
            border: "1px solid var(--color-border)",
            padding: "24px 20px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 999,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#c2410c",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            いまは開発中の仮コンテンツです
          </div>
          <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>
            次に実装しやすい順
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              color: "var(--color-text-muted)",
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            まずは俯瞰しやすい月間ヒートマップ、その次に比較しやすい選択式折れ線、
            最後にコメント要約の順が自然です。
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {["1. 月間ヒートマップ", "2. 業種選択チャート", "3. モメンタム要約"].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "#eef2ff",
                    color: "#1d4ed8",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {item}
                </div>
              )
            )}
          </div>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/tools/topix33"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              background: "var(--color-accent)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            既存の TOPIX33 を見る
          </Link>
          <Link
            href="/premium/login"
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
            ログイン画面に戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
