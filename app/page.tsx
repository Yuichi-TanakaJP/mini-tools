// app/page.tsx
"use client";

import Link from "next/link";
import MonetizeBar from "@/components/MonetizeBar";
import ShareButtons from "@/components/ShareButtons";
import { track } from "@/lib/analytics";

type ToolItem = {
  title: string;
  short: string; // カードに常時出す1行
  detail: string; // ホバーで出す説明
  href: string;
  icon: string; // 絵文字でOK（将来SVGにしても良い）
};

const TOOLS: ToolItem[] = [
  {
    title: "合計計算",
    short: "数字を貼るだけ",
    detail: "1行ごとに入力 → 合計。カンマ/円/マイナスもOK。入力は端末内保存。",
    href: "/tools/total",
    icon: "🧮",
  },
  {
    title: "文字数カウント",
    short: "文章を貼るだけ",
    detail:
      "Xやnote下書きを貼って文字数を確認。140/280の残り、スペース/改行除外も表示。入力は端末内保存。",
    href: "/tools/charcount",
    icon: "🔤",
  },
];

export default function HomePage() {
  const onOpen = (href: string) => {
    track("tool_opened", { href });
  };

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.badge}>mini-tools</div>
        <h1 style={styles.h1}>サクッと使えるミニツール集</h1>
        <p style={styles.lead}>
          数字を貼るだけ。面倒を減らす。シンプルに最短で。
        </p>
        <p style={styles.note}>
          ※入力データは基本この端末（ブラウザ）に保存され、サーバーには送信しません。
        </p>
      </section>

      <section style={styles.section}>
        <div style={styles.toolsHeader} className="toolsHeader">
          ツールを選ぶ
        </div>

        <div style={styles.grid}>
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => onOpen(t.href)}
              style={styles.cardLink}
              className="toolLink"
            >
              <div style={styles.card} className="toolCard">
                <div style={styles.cardTop}>
                  <div style={styles.icon}>{t.icon}</div>
                  <div style={styles.arrow} aria-hidden>
                    →
                  </div>
                </div>

                <div style={styles.cardTitle}>{t.title}</div>
                <div style={styles.cardShort}>{t.short}</div>

                {/* ホバーで出る説明（スマホは「タップで見える」ように details を併用） */}
                <div style={styles.hoverHint} className="hoverHint">
                  詳細を見る
                </div>

                {/* モバイル/非ホバー用：タップで展開 */}
                <details style={styles.details} className="toolDetails">
                  <summary
                    style={styles.summary}
                    onClick={(e) => e.stopPropagation()}
                  >
                    説明を表示
                  </summary>
                  <div style={styles.detailText}>{t.detail}</div>
                </details>

                {/* デスクトップ：ホバーで表示 */}
                <div className="tooltip" style={styles.tooltip}>
                  {t.detail}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={styles.bottom}>
        <div style={styles.bottomHeader}>
          <div style={styles.bottomTitle}>シェア / 応援</div>
          <div style={styles.bottomSub}>
            よければ拡散・応援してもらえると助かります
          </div>
        </div>

        <div style={styles.bottomGrid}>
          <div style={styles.footerActionArea}>
            <div style={styles.hr} />

            <div style={styles.centerRow}>
              <ShareButtons
                text="mini-tools：サクッと使えるミニツール集"
                methods={["x", "copy", "email", "facebook"]}
                label={undefined}
              />
            </div>

            {/* 分離の余白 */}
            <div style={{ height: 40 }} />

            <div style={styles.centerCol}>
              <MonetizeBar />
            </div>
          </div>
        </div>
      </section>

      {/* hover tooltip / card hover をCSSで（inlineだけだと擬似セレクタが書けないため） */}
      <style>{css}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "28px 16px 44px",
    background:
      "radial-gradient(1200px 500px at 20% 0%, rgba(0,0,0,0.06), transparent 60%)",
  },

  hero: {
    padding: "18px 0 10px",
  },
  toolsHeader: {
    marginTop: 24,
    marginBottom: 12,
    padding: "10px 14px",
    background: "rgba(0,0,0,0.02)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(0,0,0,0.70)",
    display: "block",
    width: "100%",
    position: "relative",
  },
  badge: {
    display: "inline-block",
    fontWeight: 700,
    letterSpacing: 0.2,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.02)",
    opacity: 0.85,
    marginBottom: 10,
  },
  h1: {
    fontSize: 34,
    lineHeight: 1.15,
    margin: "6px 0 8px",
    letterSpacing: -0.6,
  },
  lead: {
    margin: 0,
    opacity: 0.9,
    fontSize: 16,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.7,
  },

  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    opacity: 0.85,
    marginBottom: 12,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 280px))",
    gap: 0,
    justifyContent: "start",
    alignItems: "start",
  },

  cardLink: {
    display: "block",
    width: "100%", // ← 固定200をやめる
    textDecoration: "none",
    color: "inherit",
  },

  card: {
    position: "relative",
    width: "100%", // ← 固定200をやめる
    aspectRatio: "1 / 1",
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(59,130,246,0.15)",
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    transition: "transform .15s ease, box-shadow .15s ease",
    overflow: "hidden",
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  icon: {
    fontSize: 28,
    lineHeight: 1,
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.06)",
  },

  arrow: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.9)",
    fontSize: 18,
    opacity: 0.7,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: -0.2,
    marginTop: 4,
  },

  cardShort: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 6,
  },

  hoverHint: {
    position: "absolute",
    left: 16,
    bottom: 16,
    fontSize: 12,
    opacity: 0.9,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  // モバイル用（ホバーが無いので）
  details: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    display: "none", // CSS側でモバイル時に表示
  },
  summary: {
    listStyle: "none",
    cursor: "pointer",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.92)",
  },
  detailText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.85,
    lineHeight: 1.5,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.92)",
  },

  // デスクトップホバー表示用 tooltip
  tooltip: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(20,20,20,0.92)",
    color: "#fff",
    fontSize: 12,
    lineHeight: 1.5,
    opacity: 0,
    transform: "translateY(6px)",
    pointerEvents: "none",
    transition: "opacity .15s ease, transform .15s ease",
  },

  bottom: {
    marginTop: 24,
    paddingTop: 10,
  },
  bottomHeader: {
    marginTop: 24,
    marginBottom: 10,
  },
  bottomTitle: {
    fontSize: 14,
    fontWeight: 800,
    opacity: 0.85,
  },
  bottomSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.65,
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  bottomPanel: {
    padding: "14px 14px",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.75)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
  },
  bottomPanelPlain: {
    padding: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
  },
  xIconLink: {
    display: "inline-grid",
    placeItems: "center",
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.9)",
    textDecoration: "none",
    color: "rgba(0,0,0,0.80)",
    fontSize: 18,
    fontWeight: 900,
  },
  footerActionArea: {
    marginTop: 56,
  },

  hr: {
    height: 1,
    background: "rgba(0,0,0,0.10)",
    width: "100%",
    marginBottom: 24,
  },

  centerRow: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },

  centerCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
};

// hover/レスポンシブ挙動はCSSで
const css = `
  /* hover はツールカードリンクだけに限定 */
  .toolLink > .toolCard {
    transition: transform .15s ease, box-shadow .15s ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .toolLink:hover > .toolCard {
      transform: translateY(-2px);
      box-shadow: 0 14px 40px rgba(0,0,0,0.10);
    }

    .toolLink:hover .arrow { opacity: 1; }
    .toolLink:hover .tooltip {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }

    .toolDetails { display: none !important; }
    .hoverHint { display: block !important; }
    .tooltip { display: block !important; }
  }

  @media (hover: none) {
    .tooltip { display: none !important; }
    .toolDetails { display: block !important; }
    .hoverHint { display: none !important; }
  }
  /* 「ツールを選ぶ」を帯っぽく：左にアクセント */
  .toolsHeader::before {
    content: "";
    position: absolute;
    left: 10px;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 999px;
    background: rgba(0,0,0,0.18);
  }

  /* Xアイコンにホバー */
  @media (hover: hover) and (pointer: fine) {
    a[aria-label="Xでシェア"]:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(0,0,0,0.10);
    }
  }
`;
