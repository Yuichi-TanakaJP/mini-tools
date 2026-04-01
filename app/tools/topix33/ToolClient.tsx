"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ToolClient.module.css";
import type {
  JpxMarketClosedDay,
  Topix33DayData,
  Topix33PageData,
  Topix33RankItem,
  Topix33SectorRecord,
} from "./types";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function getDayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekendDate(dateStr: string) {
  const day = getDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

function isMarketClosedDate(dateStr: string, holidayMap: Map<string, JpxMarketClosedDay>) {
  return holidayMap.get(dateStr)?.market_closed ?? false;
}

function sign(n: number) {
  return n > 0 ? "+" : "";
}

function fmtPct(n: number) {
  return `${sign(n)}${n.toFixed(2)}%`;
}

function getBarTone(n: number) {
  if (n > 0) return { fill: "#4ade80", text: "#166534" };
  if (n < 0) return { fill: "#f87171", text: "#991b1b" };
  return { fill: "#cbd5e1", text: "#475569" };
}

type RankingListProps = {
  title: string;
  items: Topix33RankItem[];
  maxAbs: number;
};

function RankingList({ title, items, maxAbs }: RankingListProps) {
  return (
    <section
      style={{
        background: "var(--color-bg-card)",
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        padding: 14,
      }}
    >
      <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 900 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>データがありません</div>
        ) : (
          items.map((item) => {
            const width = `${Math.max((Math.abs(item.chg_pct) / maxAbs) * 100, 6)}%`;
            const tone = getBarTone(item.chg_pct);

            return (
              <div key={`${title}-${item.rank}-${item.sector_code}`} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10 }}>
                <div
                  style={{
                    borderRadius: 8,
                    background: "var(--color-bg-input)",
                    border: "1px solid var(--color-border)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {item.rank}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "baseline", gap: 10, fontSize: 13 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--color-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={item.sector_name}
                    >
                      {item.sector_name}
                    </span>
                    <span style={{ fontWeight: 800, color: tone.text, whiteSpace: "nowrap" }}>
                      {fmtPct(item.chg_pct)}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 12, borderRadius: 999, background: "#e8edf5", overflow: "hidden" }}>
                    <div style={{ width, height: "100%", background: tone.fill }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

type SectorSortKey = "sector_name" | "chg_pct" | "chg";
type SortDir = "desc" | "asc";

function SectorsTable({ sectors }: { sectors: Topix33SectorRecord[] }) {
  const [sortKey, setSortKey] = useState<SectorSortKey>("chg_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const columns: { key: SectorSortKey; label: string; align: "left" | "right"; mobileHidden: boolean }[] = [
    { key: "sector_name", label: "業種", align: "left", mobileHidden: false },
    { key: "chg_pct", label: "騰落率", align: "right", mobileHidden: false },
    { key: "chg", label: "前日比", align: "right", mobileHidden: true },
  ];

  const sortedSectors = [...sectors].sort((a, b) => {
    if (sortKey === "sector_name") {
      return sortDir === "desc"
        ? b.sector_name.localeCompare(a.sector_name, "ja")
        : a.sector_name.localeCompare(b.sector_name, "ja");
    }
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  function handleSort(key: SectorSortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function getSortIndicator(key: SectorSortKey) {
    if (sortKey !== key) return null;
    if (sortDir === "desc") {
      return <span style={{ color: "#991b1b" }}> ▼</span>;
    }
    return <span style={{ color: "#166534" }}> ▲</span>;
  }

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table
        className={styles.sectorsTable}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.mobileHidden ? styles.sectorsMobileHidden : undefined}
                onClick={() => handleSort(column.key)}
                style={{
                  textAlign: column.align,
                  fontWeight: 700,
                  color: sortKey === column.key ? "var(--color-accent)" : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {column.label}{getSortIndicator(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSectors.map((sector) => {
            const tone = getBarTone(sector.chg_pct);
            return (
              <tr key={sector.sector_code} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td>
                  <div
                    style={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={sector.sector_name}
                  >
                    {sector.sector_name}
                  </div>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", color: tone.text, fontWeight: 800 }}>
                  {fmtPct(sector.chg_pct)}
                </td>
                <td className={styles.sectorsMobileHidden} style={{ textAlign: "right", whiteSpace: "nowrap", color: getBarTone(sector.chg).text }}>
                  {sign(sector.chg)}{sector.chg.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: Topix33PageData }) {
  const { manifest, initialDayData, holidays } = data;
  const [selectedDate, setSelectedDate] = useState<string>(manifest.latest_date ?? "");
  const [loadedDays, setLoadedDays] = useState<Record<string, Topix33DayData>>(() => {
    if (!initialDayData) return {};
    return { [initialDayData.date]: initialDayData };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const holidayMap = useMemo(() => {
    return new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  }, [holidays]);

  const displayDates = useMemo(() => {
    return manifest.dates.filter((date) => {
      if (isMarketClosedDate(date, holidayMap)) return false;
      return !isWeekendDate(date);
    });
  }, [holidayMap, manifest.dates]);

  const currentSelectedDate = displayDates.includes(selectedDate)
    ? selectedDate
    : displayDates[0] ?? "";
  const currentDateIndex = displayDates.indexOf(currentSelectedDate);
  const prevDate =
    currentDateIndex >= 0 && currentDateIndex < displayDates.length - 1
      ? displayDates[currentDateIndex + 1]
      : null;
  const nextDate = currentDateIndex > 0 ? displayDates[currentDateIndex - 1] : null;

  useEffect(() => {
    if (!currentSelectedDate || loadedDays[currentSelectedDate]) {
      setLoadError(null);
      return;
    }

    let active = true;

    async function loadSelectedDate() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/tools/topix33/data/${currentSelectedDate}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const day = (await res.json()) as Topix33DayData;
        if (!active) return;
        setLoadedDays((current) => ({ ...current, [day.date]: day }));
      } catch {
        if (!active) return;
        setLoadError("データを読み込めませんでした。時間をおいて再度お試しください。");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSelectedDate();

    return () => {
      active = false;
    };
  }, [currentSelectedDate, loadedDays]);

  const dayData = currentSelectedDate ? loadedDays[currentSelectedDate] ?? null : null;
  const marketBreadth = dayData?.summary;

  const rankingMaxAbs = useMemo(() => {
    if (!dayData) return 1;
    return Math.max(
      1,
      ...dayData.top_positive.map((item) => Math.abs(item.chg_pct)),
      ...dayData.top_negative.map((item) => Math.abs(item.chg_pct)),
    );
  }, [dayData]);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* ヘッダー */}
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>📈</span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.7 }}>TOPIX33業種</h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
          TOPIX33業種の騰落率を日付ごとに確認できます。上昇・下落ランキングと全33業種の一覧をまとめて見られます。
        </p>
      </section>

      {/* 日付ナビ */}
      <section
        style={{
          background: "#fff",
          border: "1px solid rgba(15, 23, 42, 0.04)",
          borderRadius: 22,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => prevDate && setSelectedDate(prevDate)}
            disabled={!prevDate}
            aria-label="前日へ移動"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 999,
              border: "1px solid rgba(37, 84, 255, 0.12)",
              background: "#f5f8ff",
              color: prevDate ? "#2554ff" : "#b9c2d0",
              display: "grid",
              placeItems: "center",
              cursor: prevDate ? "pointer" : "default",
              opacity: prevDate ? 1 : 0.45,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M9.75 3.5L5.25 8L9.75 12.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <select
            value={currentSelectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={displayDates.length === 0}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1.5px solid rgba(37, 84, 255, 0.18)",
              background: "#f5f8ff",
              color: "#2554ff",
              fontWeight: 700,
              fontSize: 15,
              appearance: "none",
              cursor: displayDates.length > 0 ? "pointer" : "default",
            }}
          >
            {displayDates.length === 0 ? (
              <option value="">データなし</option>
            ) : (
              displayDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => nextDate && setSelectedDate(nextDate)}
            disabled={!nextDate}
            aria-label="翌日へ移動"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 999,
              border: "1px solid rgba(37, 84, 255, 0.12)",
              background: "#f5f8ff",
              color: nextDate ? "#2554ff" : "#b9c2d0",
              display: "grid",
              placeItems: "center",
              cursor: nextDate ? "pointer" : "default",
              opacity: nextDate ? 1 : 0.45,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6.25 3.5L10.75 8L6.25 12.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0" }}>
            <div className={styles.spinner} />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>読み込み中…</span>
          </div>
        )}
        {loadError && !isLoading && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#991b1b", padding: "4px 0" }}>
            {loadError}
          </div>
        )}
      </section>

      {/* サマリー */}
      {marketBreadth && (
        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            padding: 14,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900 }}>サマリー</h2>
          <div
            className={styles.summaryGrid}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
            }}
          >
            {[
              { label: "上昇業種", value: marketBreadth.advancers, color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
              { label: "下落業種", value: marketBreadth.decliners, color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
              { label: "変わらず", value: marketBreadth.unchanged, color: "#475569", bg: "var(--color-bg-input)", border: "var(--color-border)" },
            ].map(({ label, value, color, bg, border }) => (
              <div
                key={label}
                className={styles.summaryCard}
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div className={styles.summaryLabel} style={{ fontWeight: 700, color }}>
                  {label}
                </div>
                <div className={styles.summaryValue} style={{ fontWeight: 900, color }}>
                  {value}
                  <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 2 }}>業種</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ランキング */}
      {dayData && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <RankingList title="上昇ランキング" items={dayData.top_positive} maxAbs={rankingMaxAbs} />
          <RankingList title="下落ランキング" items={dayData.top_negative} maxAbs={rankingMaxAbs} />
        </div>
      )}

      {/* 全33業種一覧 */}
      {dayData && dayData.sectors.length > 0 && (
        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            padding: 14,
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900 }}>全33業種一覧</h2>
          <SectorsTable sectors={dayData.sectors} />
        </section>
      )}

      {/* データなし */}
      {!isLoading && !loadError && !dayData && displayDates.length === 0 && (
        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            padding: 32,
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
            表示できるデータがありません。
          </p>
        </section>
      )}
    </main>
  );
}
