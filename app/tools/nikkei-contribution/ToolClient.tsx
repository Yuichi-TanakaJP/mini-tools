"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ToolClient.module.css";
import type {
  JpxMarketClosedDay,
  NikkeiContributionDayData,
  NikkeiContributionPageData,
  NikkeiContributionRankItem,
  NikkeiContributionRecord,
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

function isLikelyMarketClosed(dayData: NikkeiContributionDayData | null | undefined) {
  if (!dayData || dayData.records.length === 0) {
    return false;
  }

  const hasMovement = dayData.records.some(
    (record) => record.chg !== 0 || record.chg_pct !== 0 || record.contribution !== 0,
  );

  return !hasMovement;
}

function sign(n: number) {
  return n > 0 ? "+" : "";
}

function fmtPct(n: number) {
  return `${sign(n)}${n.toFixed(2)}%`;
}

function fmtPt(n: number) {
  return `${sign(n)}${n.toFixed(1)}pt`;
}

function fmtNumber(n: number) {
  return n.toLocaleString("ja-JP");
}

function fmtPrice(n: number) {
  return n.toLocaleString("ja-JP", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function getTone(n: number) {
  if (n >= 5) return { bg: "#166534", fg: "#f0fdf4" };
  if (n > 1) return { bg: "#7bc96f", fg: "#052e16" };
  if (n >= 0) return { bg: "#dcfce7", fg: "#14532d" };
  if (n <= -5) return { bg: "#991b1b", fg: "#fef2f2" };
  if (n < -1) return { bg: "#ff6b57", fg: "#431407" };
  return { bg: "#fee2e2", fg: "#7f1d1d" };
}

function getBarTone(n: number) {
  if (n > 0) return { fill: "#4ade80", text: "#166534" };
  if (n < 0) return { fill: "#f87171", text: "#991b1b" };
  return { fill: "#cbd5e1", text: "#475569" };
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => char + char).join("")
    : value;
  const num = Number.parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getReadableTextColor(bgHex: string) {
  const { r, g, b } = hexToRgb(bgHex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#f8fafc";
}

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function getShortDisplayName(name: string, maxLength: number) {
  if (name.length <= maxLength) {
    return name;
  }
  return `${name.slice(0, Math.max(1, maxLength - 1))}…`;
}

function sumContribution(items: NikkeiContributionRecord[]) {
  return items.reduce((total, item) => total + item.contribution, 0);
}

function sumPositiveContribution(items: NikkeiContributionRecord[]) {
  return items.reduce((total, item) => total + (item.contribution > 0 ? item.contribution : 0), 0);
}

function sumNegativeContribution(items: NikkeiContributionRecord[]) {
  return items.reduce((total, item) => total + (item.contribution < 0 ? item.contribution : 0), 0);
}

type RankingListProps = {
  title: string;
  items: NikkeiContributionRankItem[];
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
            const width = `${Math.max((Math.abs(item.contribution) / maxAbs) * 100, 6)}%`;
            const tone = getBarTone(item.contribution);

            return (
              <div key={`${title}-${item.rank}-${item.code}`} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10 }}>
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
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontWeight: 800, color: tone.text, whiteSpace: "nowrap" }}>
                      {fmtPt(item.contribution)}
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

type ImpactMapProps = {
  records: NikkeiContributionRecord[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
};

type TreemapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TreemapItem = {
  record: NikkeiContributionRecord;
  size: number;
};

function normalizeTreemapItems(records: NikkeiContributionRecord[], dx: number, dy: number) {
  const items = records.map((record) => ({
    record,
    size: Math.max(record.size_value || record.weight_pct, 0.03),
  }));
  const totalSize = items.reduce((sum, item) => sum + item.size, 0) || 1;
  const totalArea = dx * dy;

  return items.map((item) => ({
    record: item.record,
    size: (item.size * totalArea) / totalSize,
  }));
}

function treemapLayoutRow(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  const coveredArea = items.reduce((sum, item) => sum + item.size, 0);
  const width = coveredArea / dy;
  const rects: Array<{ record: NikkeiContributionRecord; rect: TreemapRect }> = [];
  let cursorY = y;

  for (const item of items) {
    const height = item.size / width;
    rects.push({
      record: item.record,
      rect: { x, y: cursorY, width, height },
    });
    cursorY += height;
  }

  return rects;
}

function treemapLayoutCol(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  const coveredArea = items.reduce((sum, item) => sum + item.size, 0);
  const height = coveredArea / dx;
  const rects: Array<{ record: NikkeiContributionRecord; rect: TreemapRect }> = [];
  let cursorX = x;

  for (const item of items) {
    const width = item.size / height;
    rects.push({
      record: item.record,
      rect: { x: cursorX, y, width, height },
    });
    cursorX += width;
  }

  return rects;
}

function treemapLayout(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  return dx >= dy
    ? treemapLayoutRow(items, x, y, dx, dy)
    : treemapLayoutCol(items, x, y, dx, dy);
}

function treemapLeftoverRow(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  const coveredArea = items.reduce((sum, item) => sum + item.size, 0);
  const width = coveredArea / dy;
  return { x: x + width, y, width: dx - width, height: dy };
}

function treemapLeftoverCol(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  const coveredArea = items.reduce((sum, item) => sum + item.size, 0);
  const height = coveredArea / dx;
  return { x, y: y + height, width: dx, height: dy - height };
}

function treemapLeftover(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  return dx >= dy
    ? treemapLeftoverRow(items, x, y, dx, dy)
    : treemapLeftoverCol(items, x, y, dx, dy);
}

function worstAspectRatio(items: TreemapItem[], x: number, y: number, dx: number, dy: number) {
  const rects = treemapLayout(items, x, y, dx, dy);
  return Math.max(
    ...rects.map(({ rect }) => Math.max(rect.width / rect.height, rect.height / rect.width)),
  );
}

function squarifyLayout(items: TreemapItem[], x: number, y: number, dx: number, dy: number): Array<{ record: NikkeiContributionRecord; rect: TreemapRect }> {
  if (items.length === 0) {
    return [];
  }

  if (items.length === 1) {
    return treemapLayout(items, x, y, dx, dy);
  }

  let i = 1;
  while (
    i < items.length &&
    worstAspectRatio(items.slice(0, i), x, y, dx, dy) >=
      worstAspectRatio(items.slice(0, i + 1), x, y, dx, dy)
  ) {
    i += 1;
  }

  const current = items.slice(0, i);
  const remaining = items.slice(i);
  const leftover = treemapLeftover(current, x, y, dx, dy);

  return [
    ...treemapLayout(current, x, y, dx, dy),
    ...squarifyLayout(remaining, leftover.x, leftover.y, leftover.width, leftover.height),
  ];
}

function buildTreemapLayout(records: NikkeiContributionRecord[], width: number, height: number) {
  const items = normalizeTreemapItems(
    [...records].sort((a, b) => (b.size_value || b.weight_pct) - (a.size_value || a.weight_pct)),
    width,
    height,
  );

  return squarifyLayout(items, 0, 0, width, height);
}

function ImpactMap({ records, selectedCode, onSelect }: ImpactMapProps) {
  const sorted = [...records].sort((a, b) => (b.size_value || b.weight_pct) - (a.size_value || a.weight_pct));
  const placements = useMemo(() => buildTreemapLayout(sorted, 100, 100), [sorted]);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [hoverIntent, setHoverIntent] = useState<{ code: string | null; active: boolean }>({
    code: null,
    active: false,
  });
  const hoveredPlacement = placements.find(({ record }) => record.code === hoveredCode) ?? null;

  useEffect(() => {
    if (!hoverIntent.active || !hoverIntent.code) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHoveredCode(hoverIntent.code);
    }, 320);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hoverIntent]);

  return (
    <section
      style={{
        background: "var(--color-bg-card)",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>影響度マップ</h2>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          面積: ウェイト / 色: 騰落率 / ホバーで詳細
        </span>
      </div>
      {sorted.length === 0 ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>データがありません</div>
      ) : (
        <>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              background: "var(--color-bg-input)",
              overflow: "hidden",
              border: "1px solid #d7dee8",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {placements.map(({ record, rect }) => {
              const tone = getTone(record.color_value || record.chg_pct);
              const selected = selectedCode === record.code;
              const hovered = hoveredCode === record.code;
              const area = rect.width * rect.height;
              const minSide = Math.min(rect.width, rect.height);
              const textColor = getReadableTextColor(tone.bg);
              const showLarge = area >= 170;
              const showMedium = !showLarge && area >= 78 && minSide >= 4.8;
              const showSmallName = !showLarge && !showMedium && area >= 34 && minSide >= 3.6;
              const showPctOnly = !showLarge && !showMedium && !showSmallName && area >= 20;
              const titleSize = showLarge
                ? Math.min(17, Math.max(10, minSide * 0.68))
                : showMedium
                ? Math.min(11, Math.max(7.5, minSide * 0.5))
                : showSmallName
                ? Math.min(8.5, Math.max(6.5, minSide * 0.38))
                : 0;
              const pctSize = showLarge
                ? Math.min(13, Math.max(8.5, minSide * 0.48))
                : showMedium
                ? Math.min(9.5, Math.max(6.5, minSide * 0.38))
                : showPctOnly
                ? Math.min(8.5, Math.max(6.5, minSide * 0.38))
                : 0;
              const ptSize = showLarge ? Math.min(11, Math.max(7.5, minSide * 0.4)) : 0;
              const nameLabel = showLarge
                ? getShortDisplayName(record.name, 16)
                : showMedium
                ? getShortDisplayName(record.name, 12)
                : showSmallName
                ? getShortDisplayName(record.name, 8)
                : "";
              const pctColor = record.chg_pct >= 0 ? withAlpha(textColor, "f2") : withAlpha(textColor, "eb");
              const ptColor = record.contribution >= 0 ? withAlpha(textColor, "d9") : withAlpha(textColor, "c9");

              return (
                <button
                  key={record.code}
                  type="button"
                  onClick={() => onSelect(record.code)}
                  onMouseEnter={() => setHoverIntent({ code: record.code, active: true })}
                  onMouseLeave={() => {
                    setHoverIntent({ code: null, active: false });
                    setHoveredCode((current) => (current === record.code ? null : current));
                  }}
                  title={`${record.name} (${record.code})\n騰落率 ${fmtPct(record.chg_pct)} / 寄与度 ${fmtPt(record.contribution)} / ウェイト ${record.weight_pct.toFixed(2)}%`}
                  style={{
                    position: "absolute",
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${Math.max(0, rect.width)}%`,
                    height: `${Math.max(0, rect.height)}%`,
                    borderRadius: 0,
                    padding: showLarge ? 8 : showMedium ? 4 : showSmallName ? 3 : 2,
                    background: tone.bg,
                    color: textColor,
                    border: selected
                      ? "2px solid #0f172a"
                      : hovered
                      ? "1.5px solid rgba(15,23,42,0.7)"
                      : "1px solid rgba(255,255,255,0.95)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    textAlign: "center",
                    cursor: "pointer",
                    boxShadow: selected
                      ? "0 0 0 1px rgba(15,23,42,0.12)"
                      : hovered
                      ? "inset 0 0 0 1px rgba(255,255,255,0.28)"
                      : "none",
                    transform: hovered ? "scale(1.01)" : "scale(1)",
                    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, filter 120ms ease",
                    filter: hovered ? "saturate(1.06) brightness(1.01)" : "none",
                  }}
                >
                  {showLarge || showMedium ? (
                    <div style={{ width: "100%", lineHeight: 1.04, display: "grid", gap: 3, alignItems: "center", textShadow: textColor === "#f8fafc" ? "0 1px 1px rgba(15,23,42,0.35)" : "none" }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: titleSize,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          letterSpacing: showLarge ? -0.6 : -0.3,
                        }}
                      >
                        {nameLabel}
                      </div>
                      <div
                        style={{
                          fontSize: pctSize,
                          fontWeight: 800,
                          color: pctColor,
                          letterSpacing: -0.2,
                        }}
                      >
                        {fmtPct(record.chg_pct)}
                      </div>
                      {showLarge ? (
                        <div
                          style={{
                            fontSize: ptSize,
                            fontWeight: 700,
                            color: ptColor,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            letterSpacing: -0.2,
                          }}
                        >
                          {fmtPt(record.contribution)}
                        </div>
                      ) : null}
                    </div>
                  ) : showSmallName ? (
                    <div
                      style={{
                        width: "100%",
                        fontSize: titleSize,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: withAlpha(textColor, "e6"),
                        textShadow: textColor === "#f8fafc" ? "0 1px 1px rgba(15,23,42,0.28)" : "none",
                      }}
                    >
                      {nameLabel}
                    </div>
                  ) : showPctOnly ? (
                    <div
                      style={{
                        fontSize: pctSize,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: pctColor,
                        textShadow: textColor === "#f8fafc" ? "0 1px 1px rgba(15,23,42,0.35)" : "none",
                      }}
                    >
                      {fmtPct(record.chg_pct)}
                    </div>
                  ) : null}
                </button>
              );
            })}
            {hoveredPlacement ? (
              (() => {
                const preferRight = hoveredPlacement.rect.x + hoveredPlacement.rect.width < 74;
                const preferBottom = hoveredPlacement.rect.y < 72;
                const left = preferRight
                  ? Math.min(hoveredPlacement.rect.x + hoveredPlacement.rect.width + 1, 74)
                  : Math.max(hoveredPlacement.rect.x - 23, 1);
                const top = preferBottom
                  ? Math.min(hoveredPlacement.rect.y + 1, 74)
                  : Math.max(hoveredPlacement.rect.y - 18, 1);

                return (
                  <div
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: `${top}%`,
                      zIndex: 3,
                      pointerEvents: "none",
                      minWidth: 180,
                      maxWidth: 240,
                      padding: "10px 12px",
                      background: "rgba(15,23,42,0.92)",
                      color: "#f8fafc",
                      border: "1px solid rgba(255,255,255,0.14)",
                      boxShadow: "0 10px 30px rgba(15,23,42,0.28)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 2 }}>
                  {hoveredPlacement.record.name}
                </div>
                <div style={{ fontSize: 11, color: "rgba(226,232,240,0.82)", marginBottom: 8 }}>
                  {hoveredPlacement.record.code}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: 12 }}>
                  <span style={{ color: "rgba(148,163,184,0.95)" }}>騰落率</span>
                  <span style={{ fontWeight: 800 }}>{fmtPct(hoveredPlacement.record.chg_pct)}</span>
                  <span style={{ color: "rgba(148,163,184,0.95)" }}>寄与度</span>
                  <span style={{ fontWeight: 800 }}>{fmtPt(hoveredPlacement.record.contribution)}</span>
                  <span style={{ color: "rgba(148,163,184,0.95)" }}>ウェイト</span>
                  <span style={{ fontWeight: 800 }}>{hoveredPlacement.record.weight_pct.toFixed(2)}%</span>
                  <span style={{ color: "rgba(148,163,184,0.95)" }}>前日比</span>
                  <span style={{ fontWeight: 800 }}>{sign(hoveredPlacement.record.chg)}{fmtNumber(hoveredPlacement.record.chg)}</span>
                </div>
                  </div>
                );
              })()
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
            <span>濃い緑: +5%以上</span>
            <span>緑: +1%〜+5%</span>
            <span>薄緑: 0%〜+1%</span>
            <span>薄赤: -1%〜0%</span>
            <span>赤: -5%〜-1%</span>
            <span>濃い赤: -5%以下</span>
          </div>
        </>
      )}
    </section>
  );
}

type RecordSortKey = "name" | "weight_pct" | "chg_pct" | "chg" | "contribution";
type SortDir = "desc" | "asc";
type NameMode = "name" | "code";

function RecordsTable({ records }: { records: NikkeiContributionRecord[] }) {
  const [sortKey, setSortKey] = useState<RecordSortKey>("contribution");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [nameMode, setNameMode] = useState<NameMode>("name");

  const columns: { key: RecordSortKey; label: string; mobileLabel?: string; align: "left" | "right"; mobileHidden: boolean }[] = [
    { key: "name", label: "銘柄", align: "left", mobileHidden: false },
    { key: "weight_pct", label: "ウェイト", mobileLabel: "比率", align: "right", mobileHidden: false },
    { key: "chg_pct", label: "騰落率", mobileLabel: "騰落", align: "right", mobileHidden: false },
    { key: "chg", label: "前日比", align: "right", mobileHidden: true },
    { key: "contribution", label: "寄与度", mobileLabel: "寄与", align: "right", mobileHidden: false },
  ];

  const sortedRecords = [...records].sort((a, b) => {
    if (sortKey === "name") {
      const aVal = nameMode === "name" ? a.name : a.code;
      const bVal = nameMode === "name" ? b.name : b.code;
      return aVal.localeCompare(bVal, "ja");
    }
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  function handleSort(key: RecordSortKey) {
    if (key === "name") {
      if (sortKey === "name") {
        setNameMode((prev) => (prev === "name" ? "code" : "name"));
      } else {
        setSortKey("name");
        setNameMode("name");
      }
    } else {
      if (sortKey === key) {
        setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    }
  }

  function getSortIndicator(key: RecordSortKey) {
    if (sortKey !== key) return null;
    if (key === "name") {
      const label = nameMode === "name" ? " 名▲" : " #▲";
      return <span style={{ color: "#166534" }}>{label}</span>;
    }
    if (sortDir === "desc") {
      return <span style={{ color: "#991b1b" }}> ▼</span>;
    }
    return <span style={{ color: "#166534" }}> ▲</span>;
  }

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table
        className={styles.recordsTable}
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
                className={column.mobileHidden ? styles.recordsMobileHidden : undefined}
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
                <span className={styles.desktopOnly}>{column.label}{getSortIndicator(column.key)}</span>
                <span className={styles.mobileOnly}>{column.mobileLabel ?? column.label}{getSortIndicator(column.key)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record) => {
            const tone = getBarTone(record.contribution);
            return (
              <tr key={record.code} style={{ borderBottom: "1px solid var(--color-border)" }}>
                {columns.map((column) => {
                  if (column.key === "name") {
                    return (
                      <td key={`${record.code}-${column.key}`}>
                        <div
                          className="nikkei-records-name"
                          style={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={record.name}
                        >
                          {record.name}
                        </div>
                        <div className={styles.recordsCode} style={{ color: "var(--color-text-muted)", marginTop: 2 }}>{record.code}</div>
                      </td>
                    );
                  }

                  if (column.key === "weight_pct") {
                    return (
                      <td key={`${record.code}-${column.key}`} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <span className={styles.desktopOnly}>{record.weight_pct.toFixed(2)}%</span>
                        <span className={styles.mobileOnly}>{record.weight_pct.toFixed(1)}%</span>
                      </td>
                    );
                  }

                  if (column.key === "chg_pct") {
                    return (
                      <td key={`${record.code}-${column.key}`} style={{ textAlign: "right", whiteSpace: "nowrap", color: getBarTone(record.chg_pct).text }}>
                        <span className={styles.desktopOnly}>{fmtPct(record.chg_pct)}</span>
                        <span className={styles.mobileOnly}>{`${sign(record.chg_pct)}${record.chg_pct.toFixed(1)}%`}</span>
                      </td>
                    );
                  }

                  if (column.key === "chg") {
                    return (
                      <td key={`${record.code}-${column.key}`} className={styles.recordsMobileHidden} style={{ textAlign: "right", whiteSpace: "nowrap", color: getBarTone(record.chg).text }}>
                        {sign(record.chg)}{fmtNumber(record.chg)}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${record.code}-${column.key}`}
                      style={{
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        color: tone.text,
                        fontWeight: 800,
                      }}
                    >
                      {fmtPt(record.contribution)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: NikkeiContributionPageData }) {
  const { manifest, initialDayData, holidays } = data;
  const [selectedDate, setSelectedDate] = useState<string>(manifest.latest_date ?? "");
  const [loadedDays, setLoadedDays] = useState<Record<string, NikkeiContributionDayData>>(() => {
    if (!initialDayData) return {};
    return { [initialDayData.date]: initialDayData };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(initialDayData?.records[0]?.code ?? null);
  const holidayMap = useMemo(() => {
    return new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  }, [holidays]);
  const displayDates = useMemo(() => {
    return manifest.dates.filter((date) => {
      if (isMarketClosedDate(date, holidayMap)) {
        return false;
      }

      if (isWeekendDate(date)) {
        return false;
      }

      const loaded = loadedDays[date];
      if (!loaded) {
        return true;
      }

      return !isLikelyMarketClosed(loaded);
    });
  }, [holidayMap, loadedDays, manifest.dates]);
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
        const res = await fetch(`/tools/nikkei-contribution/data/${currentSelectedDate}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const day = (await res.json()) as NikkeiContributionDayData;
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
  const selectedRecord = useMemo(() => {
    if (!dayData) return null;
    return dayData.records.find((record) => record.code === selectedCode) ?? dayData.records[0] ?? null;
  }, [dayData, selectedCode]);
  const topWeight = useMemo(() => {
    if (!dayData) return [];
    return [...dayData.records]
      .sort((a, b) => b.weight_pct - a.weight_pct)
      .slice(0, 4);
  }, [dayData]);
  const marketBreadth = dayData?.summary;
  const positiveTotal = dayData ? sumPositiveContribution(dayData.records) : 0;
  const negativeTotal = dayData ? sumNegativeContribution(dayData.records) : 0;
  const rankingMaxAbs = useMemo(() => {
    if (!dayData) return 1;
    return Math.max(
      1,
      ...dayData.top_positive.map((item) => Math.abs(item.contribution)),
      ...dayData.top_negative.map((item) => Math.abs(item.contribution)),
    );
  }, [dayData]);
  useEffect(() => {
    if (!dayData) return;
    if (!selectedCode || !dayData.records.some((record) => record.code === selectedCode)) {
      setSelectedCode(dayData.records[0]?.code ?? null);
    }
  }, [dayData, selectedCode]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 16px 64px" }}>
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>🗺️</span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.7 }}>日経225寄与度</h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
          誰が日経225を押し上げたか、押し下げたかを日付ごとに確認できます。X では載せきれない詳細を一覧で追えるページです。
        </p>
      </section>

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
              <path
                d="M9.75 3.5L5.25 8L9.75 12.5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <select
            value={currentSelectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={displayDates.length === 0}
            style={{
              padding: "8px 12px",
              minWidth: 210,
              borderRadius: 10,
              border: "1.5px solid rgba(148, 163, 184, 0.35)",
              background: "#fff",
              color: "#0f172a",
              fontSize: 13,
              fontWeight: 700,
              textAlignLast: "center",
            }}
          >
            {displayDates.length === 0 ? (
              <option value="">データ準備中</option>
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
              <path
                d="M6.25 3.5L10.75 8L6.25 12.5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isLoading ? (
            <div className={`${styles.spinner} ${styles.spinnerSmall}`} aria-label="読み込み中" />
          ) : dayData?.market_status ? (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
              }}
            >
              {dayData.market_status}
            </span>
          ) : null}
        </div>

        <div
          className={styles.summaryGrid}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <div
            className={styles.summaryCard}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className={styles.summaryLabel} style={{ color: "var(--color-text-muted)" }}>合計寄与</div>
            <div className={styles.summaryValue} style={{ lineHeight: 1, fontWeight: 900, color: getBarTone(dayData?.summary.total_contribution ?? 0).text }}>
              {dayData ? fmtPt(dayData.summary.total_contribution) : "-"}
            </div>
          </div>
          <div
            className={styles.summaryCard}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className={styles.summaryLabel} style={{ color: "var(--color-text-muted)" }}>上昇 / 下落 / 横ばい</div>
            <div className={styles.summaryValue} style={{ lineHeight: 1, fontWeight: 900 }}>
              {marketBreadth ? `${marketBreadth.advancers} / ${marketBreadth.decliners} / ${marketBreadth.unchanged}` : "-"}
            </div>
          </div>
          <div
            className={styles.summaryCard}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className={styles.summaryLabel} style={{ color: "var(--color-text-muted)" }}>上昇寄与合計</div>
            <div className={styles.summaryValue} style={{ lineHeight: 1, fontWeight: 900, color: getBarTone(positiveTotal).text }}>
              {dayData ? fmtPt(positiveTotal) : "-"}
            </div>
          </div>
          <div
            className={styles.summaryCard}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className={styles.summaryLabel} style={{ color: "var(--color-text-muted)" }}>下落寄与合計</div>
            <div className={styles.summaryValue} style={{ lineHeight: 1, fontWeight: 900, color: getBarTone(negativeTotal).text }}>
              {dayData ? fmtPt(negativeTotal) : "-"}
            </div>
          </div>
        </div>
      </section>

      {loadError ? (
        <div style={{ padding: "20px 0", color: "var(--color-text-muted)" }}>{loadError}</div>
      ) : isLoading && !dayData ? (
        <div style={{ padding: "56px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className={styles.spinner} />
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>読み込み中...</span>
        </div>
      ) : !dayData ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            padding: 24,
            color: "var(--color-text-muted)",
            lineHeight: 1.7,
          }}
        >
          データはまだ登録されていません。`market_info` 側で JSON が配置されると、このページから日付別に確認できるようになります。
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 6 }}>
            <ImpactMap
              records={dayData.records}
              selectedCode={selectedRecord?.code ?? null}
              onSelect={setSelectedCode}
            />
          </div>

          {selectedRecord ? (
            <section
              style={{
                background: "var(--color-bg-card)",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                padding: 14,
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900 }}>{selectedRecord.name}</h2>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{selectedRecord.code}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: getBarTone(selectedRecord.contribution).text }}>
                  {fmtPt(selectedRecord.contribution)}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
                <div style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>騰落率</div>
                  <div style={{ fontWeight: 800 }}>{fmtPct(selectedRecord.chg_pct)}</div>
                </div>
                <div style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>ウェイト</div>
                  <div style={{ fontWeight: 800 }}>{selectedRecord.weight_pct.toFixed(2)}%</div>
                </div>
                <div style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>前日比</div>
                  <div style={{ fontWeight: 800 }}>{sign(selectedRecord.chg)}{fmtNumber(selectedRecord.chg)}</div>
                </div>
              </div>
            </section>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 6 }}>
            <RankingList title="上昇寄与ランキング" items={dayData.top_positive} maxAbs={rankingMaxAbs} />
            <RankingList title="下落寄与ランキング" items={dayData.top_negative} maxAbs={rankingMaxAbs} />
          </div>

          <section
            style={{
              background: "var(--color-bg-card)",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              padding: 14,
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900 }}>注目ウェイト</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                  ウェイトの大きい銘柄は、小さな値動きでも指数寄与が大きくなりやすいです。
                </p>
              </div>
            </div>
            <div className={styles.topweightGrid} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {topWeight.map((record) => (
                <div
                  key={`weight-${record.code}`}
                  className={styles.topweightCard}
                  style={{
                    background: "var(--color-bg-input)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className={styles.topweightName} style={{ fontWeight: 800, lineHeight: 1.3 }}>{record.name}</div>
                  <div className={styles.topweightCode} style={{ color: "var(--color-text-muted)" }}>{record.code}</div>
                  <div className={styles.topweightValue} style={{ fontWeight: 900, lineHeight: 1.05 }}>{record.weight_pct.toFixed(2)}%</div>
                  <div className={styles.topweightMeta} style={{ color: getBarTone(record.contribution).text }}>
                    寄与度 {fmtPt(record.contribution)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              background: "var(--color-bg-card)",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              padding: 14,
            }}
          >
              <div style={{ marginBottom: 8 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900 }}>全銘柄テーブル</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                  ヘッダーをクリックして並び替えできます。
                </p>
              </div>
            <RecordsTable records={dayData.records} />
          </section>

          <p style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
            ※ 表示データは market_info で生成した JSON をもとにしています。投資判断はご自身でご確認ください。
          </p>
        </>
      )}
    </main>
  );
}
