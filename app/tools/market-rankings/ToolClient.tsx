"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  MarketRankingMarket,
  MarketRankingPageData,
  MarketRankingRecord,
  MarketRankingType,
} from "./types";

const MARKET_LABELS: Record<MarketRankingMarket, string> = {
  prime: "プライム",
  standard: "スタンダード",
  growth: "グロース",
};

const TYPE_OPTIONS: { id: MarketRankingType; label: string; description: string }[] = [
  {
    id: "market-cap",
    label: "時価総額",
    description: "時価総額の大きい順で確認",
  },
  {
    id: "dividend-yield",
    label: "配当利回り",
    description: "配当利回りの高い順で確認",
  },
];

const MARKET_ORDER: MarketRankingMarket[] = ["prime", "standard", "growth"];

function formatGeneratedAt(value: string | null) {
  if (!value) return "データ未接続";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "更新時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(time));
}

function formatMonth(value: string) {
  if (!value) return "未選択";
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

function formatMarketDate(value?: string) {
  if (!value) return "日付未取得";
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatNumber(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatChangeAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPrice(value)}`;
}

function getRateColor(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "#64748b";
  if (value > 0) return "#dc2626";
  if (value < 0) return "#2563eb";
  return "#64748b";
}

type SegmentedProps<T extends string> = {
  items: { id: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
};

type SortKey =
  | "rank"
  | "name"
  | "industry"
  | "primaryMetric"
  | "secondaryMetric"
  | "price"
  | "changeAmount"
  | "changeRate";

type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

function Segmented<T extends string>({ items, value, onChange }: SegmentedProps<T>) {
  return (
    <div style={styles.segmented}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={active ? styles.segmentButtonActive : styles.segmentButton}
          >
            <span>{item.label}</span>
            {item.description ? (
              <span style={active ? styles.segmentDescriptionActive : styles.segmentDescription}>
                {item.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function getSortValue(record: MarketRankingRecord, key: SortKey, rankingType: MarketRankingType) {
  switch (key) {
    case "rank":
      return record.rank;
    case "name":
      return record.name;
    case "industry":
      return record.industry;
    case "primaryMetric":
      return rankingType === "market-cap" ? record.marketCapOkuYen : record.dividendYieldPct;
    case "secondaryMetric":
      return rankingType === "market-cap" ? record.dividendYieldPct : record.marketCapOkuYen;
    case "price":
      return record.price;
    case "changeAmount":
      return record.changeAmount;
    case "changeRate":
      return record.changeRate;
  }
}

function getDefaultDirection(key: SortKey): SortDirection {
  return key === "name" || key === "industry" ? "asc" : "desc";
}

function RankingTable({
  rankingType,
  records,
  sortState,
  onSort,
  isMobile,
}: {
  rankingType: MarketRankingType;
  records: MarketRankingRecord[];
  sortState: SortState;
  onSort: (key: SortKey) => void;
  isMobile: boolean;
}) {
  if (records.length === 0) {
    return (
      <div style={styles.emptyBlock}>
        この市場のランキングデータはまだありません。
      </div>
    );
  }

  const primaryMetricLabel =
    rankingType === "market-cap" ? "時価総額(億円)" : "配当利回り";
  const secondaryMetricLabel =
    rankingType === "market-cap" ? "配当利回り" : "時価総額(億円)";
  const columns = [
    { key: "rank", label: "順位", align: "right" },
    { key: "name", label: "銘柄", align: "left" },
    { key: "industry", label: "業種", align: "left" },
    { key: "primaryMetric", label: primaryMetricLabel, align: "right" },
    { key: "secondaryMetric", label: secondaryMetricLabel, align: "right" },
    { key: "price", label: "現在値", align: "right" },
    { key: "changeAmount", label: "前日比", align: "right" },
    { key: "changeRate", label: "騰落率", align: "right" },
  ] satisfies { key: SortKey; label: string; align: "left" | "right" }[];
  const visibleColumns = columns.filter(
    (column) => !isMobile || (column.key !== "changeAmount" && column.key !== "changeRate"),
  );

  return (
    <div style={styles.tableWrap}>
      <table style={isMobile ? styles.tableMobile : styles.table}>
        <thead>
          <tr>
            {visibleColumns.map((column) => {
              const active = sortState?.key === column.key;
              const thStyle = isMobile
                ? column.align === "left"
                  ? styles.thLeftMobile
                  : styles.thRightMobile
                : column.align === "left"
                ? styles.thLeft
                : styles.thRight;
              return (
                <th key={column.key} style={thStyle}>
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    style={
                      column.align === "left"
                        ? active
                          ? styles.sortButtonLeftActive
                          : styles.sortButtonLeft
                        : active
                        ? styles.sortButtonRightActive
                        : styles.sortButtonRight
                    }
                  >
                    <span>{column.label}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const rateColor = getRateColor(record.changeRate);
            const primaryMetricStyle = isMobile
              ? styles.tdCenterStrongMobile
              : styles.tdCenterStrong;
            return (
              <tr key={`${record.code}-${record.rank}`} style={styles.row}>
                <td style={isMobile ? styles.tdCenterMutedMobile : styles.tdCenterMuted}>{record.rank}</td>
                <td style={isMobile ? styles.tdLeftMobile : styles.tdLeft}>
                  <div style={styles.nameRow}>
                    <div style={isMobile ? styles.nameMobile : styles.name}>{record.name}</div>
                    <span style={styles.codeChip}>{record.code}</span>
                  </div>
                </td>
                <td style={isMobile ? styles.tdLeftSubMobile : styles.tdLeftSub}>{record.industry}</td>
                <td style={primaryMetricStyle}>
                  {rankingType === "market-cap"
                    ? formatNumber(record.marketCapOkuYen, 1)
                    : formatNumber(record.dividendYieldPct, 2)}
                </td>
                <td style={isMobile ? styles.tdRightSubMobile : styles.tdRightSub}>
                  {rankingType === "market-cap"
                    ? formatNumber(record.dividendYieldPct, 2)
                    : formatNumber(record.marketCapOkuYen, 1)}
                </td>
                <td style={isMobile ? styles.tdRightMobile : styles.tdRight}>
                  {formatPrice(record.price)}
                  <span style={styles.unit}>円</span>
                </td>
                {!isMobile ? (
                  <td style={{ ...styles.tdRight, color: rateColor, fontWeight: 700 }}>
                    {formatChangeAmount(record.changeAmount)}
                  </td>
                ) : null}
                {!isMobile ? (
                  <td style={styles.tdRight}>
                    <span style={{ ...styles.rateBadge, color: rateColor, background: `${rateColor}12` }}>
                      {formatPercent(record.changeRate)}
                    </span>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: MarketRankingPageData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMarket, setSelectedMarket] = useState<MarketRankingMarket>("prime");
  const [sortState, setSortState] = useState<SortState>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const availableMonths = data.manifest?.months ?? [];
  const availableMarkets = useMemo(
    () =>
      MARKET_ORDER.filter(
        (market) =>
          data.initialMonthData?.markets[market] &&
          Array.isArray(data.initialMonthData.markets[market]?.records),
      ),
    [data.initialMonthData],
  );
  const activeMarket =
    availableMarkets.includes(selectedMarket) ? selectedMarket : (availableMarkets[0] ?? "prime");
  const activeMarketData = data.initialMonthData?.markets[activeMarket];
  const records = useMemo(() => activeMarketData?.records ?? [], [activeMarketData]);
  const hasMonthData = data.initialMonthData !== null;
  const sortedRecords = useMemo(() => {
    if (!sortState) return records;

    const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
    const direction = sortState.direction === "asc" ? 1 : -1;

    return [...records].sort((a, b) => {
      const aValue = getSortValue(a, sortState.key, data.rankingType);
      const bValue = getSortValue(b, sortState.key, data.rankingType);

      if (typeof aValue === "string" || typeof bValue === "string") {
        const compared = collator.compare(String(aValue ?? ""), String(bValue ?? ""));
        if (compared !== 0) return compared * direction;
        return a.rank - b.rank;
      }

      const left = aValue == null ? Number.NEGATIVE_INFINITY : aValue;
      const right = bValue == null ? Number.NEGATIVE_INFINITY : bValue;
      if (left !== right) return (left - right) * direction;
      return a.rank - b.rank;
    });
  }, [data.rankingType, records, sortState]);

  function handleSort(key: SortKey) {
    setSortState((current) => {
      if (!current || current.key !== key) {
        return { key, direction: getDefaultDirection(key) };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  function replaceQuery(next: Partial<Record<"type" | "month", string>>) {
    const params = new URLSearchParams(searchParams.toString());
    const rankingType = next.type ?? data.rankingType;
    const month = next.month ?? data.selectedMonth;

    if (rankingType === "market-cap") params.delete("type");
    else params.set("type", rankingType);

    if (!month || month === data.manifest?.latest) params.delete("month");
    else params.set("month", month);

    const query = params.toString();
    router.replace(query ? `/tools/market-rankings?${query}` : "/tools/market-rankings");
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>market-info API monthly</div>
          <h1 style={styles.title}>市場ランキング</h1>
          <p style={styles.description}>
            各月のプライム・スタンダード・グロース市場について、時価総額ランキングと配当利回りランキングを切り替えて確認できます。
          </p>
          <div style={styles.metaRow}>
            <span style={styles.metaChip}>{formatGeneratedAt(data.manifest?.generatedAt ?? null)}</span>
            {data.selectedMonth ? (
              <span style={styles.metaChip}>{formatMonth(data.selectedMonth)}データ</span>
            ) : null}
            {activeMarketData?.date ? (
              <span style={styles.metaChip}>{MARKET_LABELS[activeMarket]}: {formatMarketDate(activeMarketData.date)}</span>
            ) : null}
          </div>
        </section>

        <section style={styles.controlsPanel}>
          {!data.manifest ? (
            <article style={styles.emptyCard}>
              <div style={styles.emptyTitle}>月次ランキング API が未接続です</div>
              <p style={styles.emptyText}>
                `.env.local` に `MARKET_INFO_API_BASE_URL` を設定すると、
                `market-rankings/*` エンドポイントから月次ランキングを表示できます。
              </p>
            </article>
          ) : (
            <>
              <div style={styles.section}>
                <div style={styles.sectionLabel}>ランキング種別</div>
                <Segmented
                  items={TYPE_OPTIONS}
                  value={data.rankingType}
                  onChange={(nextType) => replaceQuery({ type: nextType })}
                />
              </div>

              <div style={styles.section}>
                <div style={styles.sectionLabel}>表示月</div>
                <div style={styles.monthList}>
                  {availableMonths.map((month) => {
                    const active = month === data.selectedMonth;
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => replaceQuery({ month })}
                        style={active ? styles.monthButtonActive : styles.monthButton}
                      >
                        {formatMonth(month)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionLabel}>市場区分</div>
                <div style={styles.marketTabs}>
                  {MARKET_ORDER.map((market) => {
                    const active = market === activeMarket;
                    const disabled = !hasMonthData || !availableMarkets.includes(market);
                    return (
                      <button
                        key={market}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedMarket(market)}
                        style={
                          disabled
                            ? styles.marketButtonDisabled
                            : active
                            ? styles.marketButtonActive
                            : styles.marketButton
                        }
                      >
                        {MARKET_LABELS[market]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>

        {data.manifest ? (
          <section style={styles.tableSection}>
            {data.monthDataFailed ? (
              <article style={styles.errorCard}>
                <div style={styles.errorTitle}>
                  {formatMonth(data.selectedMonth)} の
                  {TYPE_OPTIONS.find((option) => option.id === data.rankingType)?.label}
                  データを取得できませんでした
                </div>
                <p style={styles.errorText}>
                  2026年4月11日時点で
                  <code style={styles.inlineCode}> /market-rankings/{data.rankingType}/monthly/{data.selectedMonth}</code>
                  が失敗していました。mini-tools 側ではなく API 側のレスポンス異常に見えます。
                </p>
              </article>
            ) : (
              <>
                <div style={styles.summaryRow}>
                  <div>
                    <div style={styles.summaryLabel}>
                      {TYPE_OPTIONS.find((option) => option.id === data.rankingType)?.label} / {MARKET_LABELS[activeMarket]}
                    </div>
                    <div style={styles.summarySub}>
                      最大100件の月次ランキング
                    </div>
                  </div>
                  <div style={styles.countChip}>
                    {sortedRecords.length.toLocaleString("ja-JP")}件
                  </div>
                </div>

                <RankingTable
                  rankingType={data.rankingType}
                  records={sortedRecords}
                  sortState={sortState}
                  onSort={handleSort}
                  isMobile={isMobile}
                />
              </>
            )}

            <p style={styles.note}>
              配当利回りタブにも時価総額、時価総額タブにも配当利回りが含まれます。API の共通列構造をそのまま表示しています。
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 72px",
    background:
      "radial-gradient(ellipse 1000px 400px at 0% 0%, rgba(14,165,233,0.10) 0%, transparent 60%), " +
      "radial-gradient(ellipse 900px 500px at 100% 80%, rgba(16,185,129,0.08) 0%, transparent 55%), " +
      "#f8fafc",
  },
  shell: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 24,
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
    letterSpacing: 0.4,
    border: "1px solid rgba(15,118,110,0.12)",
  },
  title: {
    margin: "12px 0 8px",
    fontSize: "clamp(30px, 6vw, 44px)",
    fontWeight: 900,
    letterSpacing: -1,
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
  controlsPanel: {
    background: "#ffffff",
    borderRadius: 28,
    padding: "22px 22px 24px",
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow:
      "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.06), 0 28px 60px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  tableSection: {
    padding: "8px 0 0",
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  segmented: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  segmentButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "10px 14px",
    borderRadius: 14,
    minWidth: 172,
    maxWidth: 220,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    color: "#0f172a",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    textAlign: "left",
  },
  segmentButtonActive: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "10px 14px",
    borderRadius: 14,
    minWidth: 172,
    maxWidth: 220,
    border: "1.5px solid #0f766e",
    background: "#ecfeff",
    color: "#134e4a",
    cursor: "default",
    fontSize: 13,
    fontWeight: 800,
    textAlign: "left",
    boxShadow: "0 0 0 2px rgba(15,118,110,0.08)",
  },
  segmentDescription: {
    fontSize: 10,
    fontWeight: 600,
    color: "#64748b",
  },
  segmentDescriptionActive: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f766e",
  },
  monthList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  monthButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  monthButtonActive: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1.5px solid #0f766e",
    background: "#ecfeff",
    color: "#0f766e",
    fontSize: 13,
    fontWeight: 800,
    cursor: "default",
  },
  marketTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  marketButton: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  marketButtonActive: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "1.5px solid #0284c7",
    background: "#eff6ff",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    cursor: "default",
  },
  marketButtonDisabled: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.05)",
    background: "#f8fafc",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
    cursor: "not-allowed",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
  },
  summarySub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  countChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#0f766e",
    fontSize: 12,
    fontWeight: 800,
  },
  tableWrap: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.72)",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    minWidth: 880,
    borderCollapse: "collapse",
    fontSize: 13,
  },
  tableMobile: {
    width: "100%",
    minWidth: 0,
    borderCollapse: "collapse",
    fontSize: 12,
  },
  thLeft: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    letterSpacing: 0.3,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  thRight: {
    padding: "10px 12px",
    textAlign: "right",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    letterSpacing: 0.3,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  thLeftMobile: {
    padding: "8px 8px",
    textAlign: "left",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    letterSpacing: 0.2,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  thRightMobile: {
    padding: "8px 6px",
    textAlign: "right",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    letterSpacing: 0.2,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  sortButtonLeft: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
  },
  sortButtonRight: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
  },
  sortButtonLeftActive: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    color: "#0f766e",
    cursor: "pointer",
  },
  sortButtonRightActive: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    color: "#0f766e",
    cursor: "pointer",
  },
  row: {
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  tdLeft: {
    padding: "10px 12px",
    textAlign: "left",
  },
  tdLeftMobile: {
    padding: "8px 8px",
    textAlign: "left",
  },
  tdLeftSub: {
    padding: "10px 12px",
    textAlign: "left",
    color: "#475569",
    whiteSpace: "nowrap",
  },
  tdLeftSubMobile: {
    padding: "8px 6px",
    textAlign: "left",
    color: "#475569",
    whiteSpace: "nowrap",
    fontSize: 11,
  },
  tdRight: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  tdRightMobile: {
    padding: "8px 8px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  tdRightStrong: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontWeight: 800,
  },
  tdRightStrongMobile: {
    padding: "8px 6px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontWeight: 800,
  },
  tdCenterStrong: {
    padding: "10px 12px",
    textAlign: "center",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontWeight: 800,
  },
  tdCenterStrongMobile: {
    padding: "8px 6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    color: "#0f172a",
    fontWeight: 800,
  },
  tdRightSub: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#475569",
  },
  tdRightSubMobile: {
    padding: "8px 6px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#475569",
  },
  tdRightMuted: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#64748b",
    fontWeight: 700,
  },
  tdRightMutedMobile: {
    padding: "8px 6px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#64748b",
    fontWeight: 700,
  },
  tdCenterMuted: {
    padding: "10px 12px",
    textAlign: "center",
    whiteSpace: "nowrap",
    color: "#64748b",
    fontWeight: 700,
  },
  tdCenterMutedMobile: {
    padding: "8px 6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    color: "#64748b",
    fontWeight: 700,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  name: {
    display: "block",
    minWidth: 0,
    flex: "1 1 auto",
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  nameMobile: {
    display: "block",
    minWidth: 0,
    flex: "1 1 auto",
    fontWeight: 800,
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  codeChip: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    padding: "1px 6px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 700,
  },
  unit: {
    marginLeft: 2,
    fontSize: 10,
    color: "#94a3b8",
  },
  subTime: {
    marginTop: 2,
    fontSize: 10,
    color: "#94a3b8",
  },
  rateBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 76,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  note: {
    margin: "14px 2px 0",
    fontSize: 12,
    lineHeight: 1.7,
    color: "#64748b",
  },
  emptyCard: {
    padding: "32px 24px",
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid rgba(15,23,42,0.05)",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },
  emptyText: {
    margin: "10px auto 0",
    maxWidth: 520,
    fontSize: 13,
    lineHeight: 1.7,
    color: "#64748b",
    whiteSpace: "pre-wrap",
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
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#9a3412",
    lineHeight: 1.5,
  },
  errorText: {
    margin: "10px 0 0",
    fontSize: 13,
    lineHeight: 1.7,
    color: "#7c2d12",
  },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: "0.95em",
    background: "rgba(255,255,255,0.7)",
    padding: "1px 4px",
    borderRadius: 6,
  },
};
