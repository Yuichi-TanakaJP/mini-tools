// app/page.tsx
import MonetizeBar from "@/components/MonetizeBar";
import ShareButtons from "@/components/ShareButtonsSuspended";
import ToolGridClient from "./ToolGridClient";

type ToolItem = {
  title: string;
  short: string;
  detail: string;
  href: string;
  icon: string;
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
  {
    title: "株主優待期限帳",
    short: "優待の期限を管理",
    detail:
      "取得した優待の有効期限（使える最終日）を管理。使用済み/未使用、期限が近い順、月別表示・ソート対応。データは端末内に保存。",
    href: "/tools/yutai-expiry",
    icon: "🎁",
  },
  {
    title: "優待銘柄メモ帳",
    short: "早取り/長期1株/任期注意/失敗ログを保存",
    detail: "早取り/長期1株/任期注意/失敗ログを保存",
    href: "/tools/yutai-memo",
    icon: "🎁",
  },
];

export default function HomePage() {
  return (
    <main style={styles.page}>
      {/* ===== ヒーローエリア（そのまま） ===== */}
      <section style={styles.hero}>
        <h1 style={styles.h1}>mini-tools</h1>
        <p style={styles.lead}>サクッと使えるミニツール集</p>
      </section>

      {/* ===== ツール一覧（Clientに分離） ===== */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>ツールを選ぶ</h2>

        {/* ★ ここが重要：track() を含むので Client Component */}
        <ToolGridClient tools={TOOLS} styles={styles} />
      </section>

      {/* ===== 下部エリア ===== */}
      <section style={styles.bottom}>
        {/* ★ useSearchParams を使うので Suspense 必須 */}
        <ShareButtons
          text="mini-tools｜サクッと使えるミニツール集"
          methods={["x", "copy", "email", "facebook"]}
        />

        <div style={{ height: 32 }} />

        <MonetizeBar />
      </section>

      {/* styles / css は今まで通り */}
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
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 240px))",
    gap: 14,
    justifyContent: "start",
    alignItems: "start",
  },

  cardLink: {
    display: "block",
    width: "100%",
    textDecoration: "none",
    color: "inherit",
  },

  card: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
  },

  cardInner: {
    boxSizing: "border-box",
    width: "100%",
    height: "100%",
    borderRadius: 18,
    padding: 14,
    border: "3px solid rgba(59,130,246,0.15)",
    background: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)", // 常時影を残すならここ
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
  .toolLink > .toolCard > .toolCardInner {
    transition: transform .15s ease, box-shadow .15s ease;
  }

  @media (hover: hover) and (pointer: fine) {
    .toolLink:hover > .toolCard > .toolCardInner {
      transform: translateY(-2px);
      box-shadow: 0 14px 40px rgba(0,0,0,0.10);
    }

    .toolLink:hover .arrow { opacity: 1; }

    .toolLink:hover > .toolCard > .toolCardInner .tooltip {
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
