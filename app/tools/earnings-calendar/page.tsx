import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "決算カレンダー | mini-tools",
  description:
    "日本株の決算予定を日付ベースで確認できる決算カレンダー。market_info データを使った表示を想定したデザイン確認用モックです。",
  alternates: {
    canonical: "/tools/earnings-calendar",
  },
};

type DayCell = {
  day: number | null;
  count?: number;
  active?: boolean;
  muted?: boolean;
};

const DAYS: DayCell[] = [
  { day: 31, muted: true },
  { day: 1, count: 8 },
  { day: 2, count: 12 },
  { day: 3, count: 5 },
  { day: 4, count: 15 },
  { day: 5, count: 22 },
  { day: 6, count: 2 },
  { day: 7 },
  { day: 8, count: 19 },
  { day: 9, count: 4 },
  { day: 10, count: 28, active: true },
  { day: 11, count: 31 },
  { day: 12, count: 45 },
  { day: 13 },
  { day: 14 },
  { day: 15, count: 52, active: true },
  { day: 16, count: 18 },
  { day: 17, count: 7 },
  { day: 18, count: 10 },
  { day: 19, count: 24 },
  { day: 20 },
  { day: 21 },
  { day: 22, count: 6 },
  { day: 23, count: 11 },
  { day: 24, count: 14 },
  { day: 25, count: 9 },
  { day: 26, count: 18 },
  { day: 27, count: 3 },
  { day: 28 },
  { day: 29, count: 7 },
  { day: 30, count: 13 },
  { day: 1, muted: true },
  { day: 2, muted: true },
  { day: 3, muted: true },
  { day: 4, muted: true },
];

const ITEMS = [
  { code: "7203", name: "トヨタ自動車", market: "プライム", time: "15:00" },
  { code: "9984", name: "ソフトバンクグループ", market: "プライム", time: "16:30" },
  { code: "6758", name: "ソニーグループ", market: "プライム", time: "15:30" },
  { code: "8306", name: "三菱UFJフィナンシャルG", market: "プライム", time: "15:00" },
];

export default function Page() {
  return (
    <main style={styles.page}>
      <div style={styles.mobileShell}>
        <header style={styles.headerRow}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark} aria-hidden>
              ■
            </div>
            <div style={styles.brandName}>mini-tools</div>
          </div>
          <div style={styles.headerIcons}>
            <span style={styles.headerIcon} aria-hidden>
              ⌕
            </span>
            <span style={styles.headerIcon} aria-hidden>
              ●
            </span>
          </div>
        </header>

        <section style={styles.heroBlock}>
          <div style={styles.heroEyebrow}>決算カレンダー beta</div>
          <h1 style={styles.heroTitle}>日本株の決算予定を日付で見る</h1>
          <p style={styles.heroNote}>
            月ごとの予定感と、その日の決算銘柄をスマホでさっと確認するためのモックです。
          </p>
        </section>

        <section style={styles.calendarCard}>
          <div style={styles.calendarTop}>
            <button type="button" style={styles.navBtn}>
              ‹
            </button>
            <div style={styles.monthLabel}>2024年4月</div>
            <button type="button" style={styles.navBtn}>
              ›
            </button>
          </div>

          <div style={styles.calendarMeta}>
            <span style={styles.metaChip}>日本株</span>
            <span style={styles.metaChipMuted}>月間ビュー</span>
            <span style={styles.metaChipMuted}>今月 352件</span>
          </div>

          <div style={styles.weekHeader}>
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <span key={d} style={styles.weekCell}>
                {d}
              </span>
            ))}
          </div>

          <div style={styles.calendarGrid}>
            {DAYS.map((item, index) => (
              <div
                key={`${item.day ?? "blank"}-${index}`}
                style={{
                  ...styles.dayCell,
                  ...(item.muted ? styles.dayMuted : {}),
                  ...(item.active ? styles.dayActive : {}),
                }}
              >
                <div style={styles.dayNumber}>{item.day ?? ""}</div>
                {item.count ? (
                  <div
                    style={{
                      ...styles.countBadge,
                      ...(item.count >= 20 ? styles.countBadgeBusy : {}),
                      ...(item.active ? styles.countBadgeActive : {}),
                    }}
                  >
                    {item.count}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div style={styles.selectionBar}>
            <div style={styles.selectionLabel}>選択中</div>
            <div style={styles.selectionValue}>4/15（月） 52件</div>
          </div>
        </section>

        <section style={styles.listSection}>
          <div style={styles.sectionAccent} />
          <div style={styles.sectionTitle}>2024年4月15日（金）の決算銘柄</div>
        </section>

        <section style={styles.itemList}>
          {ITEMS.map((item) => (
            <article key={item.code} style={styles.itemCard}>
              <div style={styles.codeBlock}>
                <div style={styles.codeLabel}>CODE</div>
                <div style={styles.codeValue}>{item.code}</div>
              </div>

              <div style={styles.itemMain}>
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.itemMarket}>🏛 {item.market}</div>
              </div>

              <div style={styles.itemTimeBlock}>
                <div style={styles.timeLabel}>予定</div>
                <div style={styles.timeValue}>{item.time}</div>
              </div>
            </article>
          ))}
        </section>

        <div style={styles.updatedAt}>データ更新日: 2024/04/10</div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 64px",
    background:
      "radial-gradient(1000px 420px at 20% 0%, rgba(37, 99, 235, 0.08), transparent 58%), #eef2f7",
  },
  mobileShell: {
    maxWidth: 380,
    margin: "0 auto",
    background: "#f8f9fb",
    borderRadius: 28,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    boxShadow: "0 20px 48px rgba(15, 23, 42, 0.10)",
    padding: "18px 14px 24px",
  },
  heroBlock: {
    marginBottom: 16,
  },
  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3b5bdb",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.1,
  },
  heroTitle: {
    margin: "10px 0 6px",
    fontSize: 22,
    lineHeight: 1.2,
    letterSpacing: -0.4,
    color: "#1f2937",
  },
  heroNote: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#667085",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    color: "#2554ff",
    fontSize: 18,
    lineHeight: 1,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#1f2937",
  },
  headerIcons: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: "#eef2ff",
    color: "#374151",
    display: "grid",
    placeItems: "center",
    fontSize: 15,
  },
  calendarCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
  },
  calendarTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  navBtn: {
    border: "none",
    background: "transparent",
    color: "#2554ff",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: 800,
    color: "#374151",
  },
  calendarMeta: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3146d4",
    fontSize: 11,
    fontWeight: 800,
  },
  metaChipMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f4f6fb",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  weekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 6,
    marginBottom: 8,
  },
  weekCell: {
    fontSize: 10,
    fontWeight: 800,
    color: "#9ca3af",
    textAlign: "center",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  },
  dayCell: {
    minHeight: 56,
    borderRadius: 14,
    padding: "7px 5px 6px",
    background: "#f3f6fb",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayMuted: {
    opacity: 0.45,
  },
  dayActive: {
    background: "#edf2ff",
    boxShadow: "inset 0 0 0 1px rgba(37, 84, 255, 0.14)",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 700,
    color: "#475569",
  },
  countBadge: {
    minWidth: 24,
    padding: "2px 6px",
    borderRadius: 999,
    background: "#e7edff",
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "center",
  },
  countBadgeActive: {
    background: "#2554ff",
    color: "#fff",
  },
  countBadgeBusy: {
    background: "#dbe5ff",
    color: "#2f47ca",
  },
  selectionBar: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectionLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.2,
  },
  selectionValue: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  listSection: {
    marginTop: 22,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  sectionAccent: {
    width: 3,
    height: 22,
    borderRadius: 999,
    background: "linear-gradient(180deg, #7562d8 0%, #9a88f5 100%)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#374151",
  },
  itemList: {
    marginTop: 14,
    display: "grid",
    gap: 12,
  },
  itemCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "56px minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  },
  codeBlock: {
    display: "grid",
    gap: 4,
    justifyItems: "center",
    padding: "8px 6px",
    borderRadius: 12,
    background: "#f5f8ff",
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
  },
  codeValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2554ff",
    lineHeight: 1,
  },
  itemMain: {
    minWidth: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1f2937",
    lineHeight: 1.35,
  },
  itemMarket: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  itemTimeBlock: {
    textAlign: "right",
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#9ca3af",
  },
  timeValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 900,
    color: "#374151",
  },
  updatedAt: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 12,
    color: "#6b7280",
  },
};
