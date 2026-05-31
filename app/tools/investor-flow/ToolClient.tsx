"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import Link from "next/link";
import type { InvestorFlowPageData, InvestorFlowRecord } from "./types";

const CATEGORY_ORDER = [
  "総計",
  "自己計",
  "委託計",
  "海外投資家",
  "個人",
  "個人現金",
  "個人信用",
  "法人計",
  "事業法人",
  "投資信託",
  "金融機関計",
  "信託銀行",
  "証券会社",
];

function formatDate(value?: string) {
  if (!value) return "未取得";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatWeek(start?: string, end?: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatGeneratedAt(value?: string) {
  if (!value) return "更新時刻不明";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(parsed));
}

function formatYen(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const oku = value / 100_000_000;
  return `${oku.toLocaleString("ja-JP", {
    maximumFractionDigits: 0,
  })}億円`;
}

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function getDiffColor(value: number) {
  if (value > 0) return "#dc2626";
  if (value < 0) return "#2563eb";
  return "#64748b";
}

function sortRecords(records: InvestorFlowRecord[]) {
  const order = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  return [...records].sort((a, b) => {
    const left = order.get(a.category) ?? 999;
    const right = order.get(b.category) ?? 999;
    if (left !== right) return left - right;
    return a.row_index - b.row_index;
  });
}

function getRecord(records: InvestorFlowRecord[], category: string) {
  return records.find((record) => record.category === category) ?? null;
}

function MetricCard({
  label,
  record,
}: {
  label: string;
  record: InvestorFlowRecord | null;
}) {
  const diff = record?.diff_yen ?? 0;
  return (
    <article style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: getDiffColor(diff) }}>
        {record ? formatYen(record.diff_yen) : "—"}
      </div>
      <div style={styles.metricSub}>
        買い {record ? formatYen(record.buy_yen) : "—"} / 売り{" "}
        {record ? formatYen(record.sell_yen) : "—"}
      </div>
    </article>
  );
}

function WeekSelector({ data }: { data: InvestorFlowPageData }) {
  const weeks = data.manifest?.weeks ?? [];
  if (weeks.length === 0) return null;
  return (
    <div style={styles.weekList}>
      {weeks.slice(0, 12).map((week) => {
        const active =
          data.selectedWeek?.start_date === week.start_date &&
          data.selectedWeek?.end_date === week.end_date;
        const href =
          week.start_date === data.manifest?.latest.start_date &&
          week.end_date === data.manifest.latest.end_date
            ? "/tools/investor-flow"
            : `/tools/investor-flow?start=${week.start_date}&end=${week.end_date}`;
        return (
          <Link
            key={`${week.start_date}-${week.end_date}`}
            href={href}
            style={active ? styles.weekButtonActive : styles.weekButton}
          >
            {formatWeek(week.start_date, week.end_date)}
          </Link>
        );
      })}
    </div>
  );
}

function FlowTable({ records }: { records: InvestorFlowRecord[] }) {
  if (records.length === 0) {
    return <div style={styles.emptyBlock}>表示できる行がありません。</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.thLeft}>投資主体</th>
            <th style={styles.thRight}>買い</th>
            <th style={styles.thRight}>売り</th>
            <th style={styles.thRight}>差引</th>
            <th style={styles.thRight}>買いシェア</th>
            <th style={styles.thRight}>売りシェア</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const diffColor = getDiffColor(record.diff_yen);
            return (
              <tr key={`${record.row_index}-${record.category}`} style={styles.row}>
                <td style={styles.tdLeft}>
                  <span style={styles.categoryName}>{record.category}</span>
                </td>
                <td style={styles.tdRight}>{formatYen(record.buy_yen)}</td>
                <td style={styles.tdRight}>{formatYen(record.sell_yen)}</td>
                <td style={{ ...styles.tdRightStrong, color: diffColor }}>
                  {formatYen(record.diff_yen)}
                </td>
                <td style={styles.tdRightMuted}>{formatPct(record.share_buy_pct)}</td>
                <td style={styles.tdRightMuted}>{formatPct(record.share_sell_pct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: InvestorFlowPageData }) {
  const records = useMemo(() => sortRecords(data.payload?.records ?? []), [data.payload]);
  const overseas = getRecord(records, "海外投資家");
  const individual = getRecord(records, "個人");
  const trust = getRecord(records, "信託銀行");
  const total = getRecord(records, "総計");
  const payload = data.payload;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>JPX weekly investor flow</div>
          <h1 style={styles.title}>投資主体別売買動向</h1>
          <p style={styles.description}>
            JPX公式の週間売買状況から、海外投資家・個人・法人などの買い越し / 売り越しを確認できます。
          </p>
          {payload ? (
            <div style={styles.metaRow}>
              <span style={styles.metaChip}>
                {formatWeek(payload.start_date, payload.end_date)}
              </span>
              <span style={styles.metaChip}>
                更新 {formatGeneratedAt(payload.generated_at_jst)}
              </span>
              <span style={styles.metaChip}>{payload.market_scope}</span>
            </div>
          ) : null}
        </section>

        {!data.manifest ? (
          <article style={styles.emptyCard}>
            <div style={styles.emptyTitle}>データ取得先が未接続です</div>
            <p style={styles.emptyText}>
              投資主体別売買動向は現在表示できません。
            </p>
          </article>
        ) : (
          <>
            <section style={styles.panel}>
              <div style={styles.sectionLabel}>表示週</div>
              <WeekSelector data={data} />
            </section>

            {data.loadFailed ? (
              <article style={styles.errorCard}>
                <div style={styles.errorTitle}>選択週のデータを取得できませんでした</div>
                <p style={styles.errorText}>
                  {formatWeek(data.selectedWeek?.start_date, data.selectedWeek?.end_date)} のデータを
                  時間を置いて再読み込みしてください。
                </p>
              </article>
            ) : (
              <>
                <section style={styles.metricsGrid}>
                  <MetricCard label="海外投資家" record={overseas} />
                  <MetricCard label="個人" record={individual} />
                  <MetricCard label="信託銀行" record={trust} />
                  <MetricCard label="総計" record={total} />
                </section>

                <section style={styles.tableSection}>
                  <div style={styles.summaryRow}>
                    <div>
                      <div style={styles.summaryTitle}>
                        {data.payload?.week_label_raw ?? "週次データ"}
                      </div>
                      <div style={styles.summarySub}>
                        単位: {data.payload?.unit === "thousand_yen" ? "千円" : data.payload?.unit ?? "—"}
                      </div>
                    </div>
                    {data.payload?.source_url ? (
                      <a
                        href={data.payload.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.sourceLink}
                      >
                        JPX元データ
                      </a>
                    ) : null}
                  </div>
                  <FlowTable records={records} />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 72px",
    background: "#f8fafc",
  },
  shell: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 22,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(15,118,110,0.12)",
  },
  title: {
    margin: "12px 0 8px",
    fontSize: "clamp(30px, 6vw, 44px)",
    fontWeight: 900,
    color: "#0f172a",
  },
  description: {
    margin: 0,
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#475569",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  panel: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  weekList: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  weekButton: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#f8fafc",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  weekButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 12,
    border: "1.5px solid #0f766e",
    background: "#ecfeff",
    color: "#134e4a",
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 900,
  },
  metricSub: {
    marginTop: 8,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.5,
  },
  tableSection: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },
  summarySub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  sourceLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  tableWrap: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
  },
  table: {
    width: "100%",
    minWidth: 760,
    borderCollapse: "collapse",
    fontSize: 13,
  },
  thLeft: {
    padding: "10px 12px",
    textAlign: "left",
    background: "#f8fafc",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  thRight: {
    padding: "10px 12px",
    textAlign: "right",
    background: "#f8fafc",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  row: {
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  tdLeft: {
    padding: "10px 12px",
    textAlign: "left",
  },
  tdRight: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  tdRightStrong: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  tdRightMuted: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#64748b",
  },
  categoryName: {
    fontWeight: 900,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  emptyCard: {
    padding: "32px 24px",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  emptyText: {
    margin: "10px auto 0",
    maxWidth: 520,
    fontSize: 13,
    lineHeight: 1.7,
    color: "#64748b",
  },
  emptyBlock: {
    padding: "32px 20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  errorCard: {
    padding: "24px 20px",
    borderRadius: 18,
    border: "1px solid rgba(245,158,11,0.28)",
    background: "#fff7ed",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#9a3412",
  },
  errorText: {
    margin: "10px 0 0",
    fontSize: 13,
    color: "#7c2d12",
    lineHeight: 1.7,
  },
};
