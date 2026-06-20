// app/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import ShareButtons from "@/components/ShareButtonsSuspended";
import ToolGridClient from "./ToolGridClient";
import { PREMIUM_EXTERNAL_TOOLS, TOOLS } from "@/lib/tools-catalog";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const metadata: Metadata = {
  title: "mini-tools | 個人投資家向けミニツール集",
  description:
    "文字数カウント、合計計算、株主優待期限管理、優待銘柄メモをブラウザで使える無料ミニツール集。インストール不要で使えます。",
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  // premium ログイン済みのときだけ、ホームに外部ツール（TODO アプリ）カードを足す。
  // サーバー側 cookie で判定するので、未ログインのクライアントには HTML 自体に出さない。
  const cookieStore = await cookies();
  const isPremium = verifyPremiumSession(cookieStore.get(PREMIUM_COOKIE_NAME)?.value);
  const tools = isPremium ? [...TOOLS, ...PREMIUM_EXTERNAL_TOOLS] : TOOLS;

  return (
    <>
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "0 16px 64px" }}>

        {/* ヒーロー */}
        <section style={{ padding: "40px 0 32px", position: "relative" }}>
          {/* 背景の装飾 */}
          <div style={{
            position: "absolute",
            top: 0,
            left: -16,
            right: -16,
            bottom: 0,
            background: "radial-gradient(ellipse 700px 300px at 10% 50%, rgba(37,84,255,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative" }}>
            {/* バッジ群 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {["無料", "要ログイン不要", "データは端末内に保存"].map((label) => (
                <span key={label} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border-strong)",
                  background: "var(--color-bg-card)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  letterSpacing: 0.2,
                }}>
                  {label}
                </span>
              ))}
            </div>

            {/* タイトル */}
            <h1 style={{
              margin: "0 0 12px",
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 900,
              letterSpacing: -1.5,
              lineHeight: 1.1,
              color: "var(--color-text)",
            }}>
              個人投資家向けの<br />
              <span style={{
                background: "linear-gradient(135deg, var(--color-accent) 0%, #60a5fa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                ミニツール集
              </span>
            </h1>

            <p style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-sub)",
              maxWidth: 480,
            }}>
              文字数カウント・合計計算・株主優待管理など、<br />
              ちょっと便利なツールをブラウザだけで使えます。
            </p>
          </div>
        </section>

        {/* ツール一覧 */}
        <section>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--color-text-muted)",
              letterSpacing: 0.5,
            }}>
              TOOLS
            </span>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--color-accent-sub)",
              color: "var(--color-accent)",
              fontSize: 11,
              fontWeight: 800,
            }}>
              {tools.length}
            </span>
          </div>

          <ToolGridClient tools={tools} />
        </section>

        {/* フッター */}
        <footer style={{ marginTop: 56 }}>
          {/* アクセントライン */}
          <div style={{
            height: 1,
            background: "linear-gradient(90deg, var(--color-accent) 0%, var(--color-border) 40%, transparent 100%)",
            marginBottom: 32,
            opacity: 0.5,
          }} />

          {/* ブランド + シェア */}
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
            marginBottom: 32,
          }}>
            <div>
              <div style={{
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: -0.5,
                marginBottom: 6,
              }}>
                <span style={{ color: "var(--color-text)" }}>mini-</span>
                <span style={{ color: "var(--color-accent)" }}>tools</span>
              </div>
              <p style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
                maxWidth: 240,
              }}>
                個人投資家向けの小さなツール集。<br />
                ブラウザだけで動き、データはあなたの端末に保存されます。
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
              <ShareButtons
                text="mini-tools｜個人投資家向けの無料ミニツール集"
                methods={["x", "copy", "email", "facebook"]}
              />
            </div>
          </div>

          {/* OFUSE 応援 */}
          <div
            className="ofuse-wrap"
            style={{
              borderRadius: 16,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-input)",
              marginBottom: 24,
            }}
          >
            <a
              href="https://ofuse.me/52617c2e"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 20px",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>☕</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 3 }}>
                  役に立ったら、コーヒー1杯分の応援を
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  OFUSE · 匿名 · 100円〜
                </div>
              </div>
              <span style={{ fontSize: 16, color: "var(--color-text-muted)" }}>→</span>
            </a>
          </div>

          <style>{`
            .ofuse-wrap:hover {
              box-shadow: 0 4px 16px rgba(15,23,42,0.08) !important;
              transform: translateY(-1px);
            }
          `}</style>

          {/* コピーライト */}
          <div style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            lineHeight: 1.7,
          }}>
            <p style={{ margin: "0 0 4px" }}>
              ※ 入力データはこの端末（ブラウザ）にのみ保存されます（localStorage）。サーバーへの送信はありません。
            </p>
            <p style={{ margin: 0 }}>
              © {new Date().getFullYear()} mini-tools
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
