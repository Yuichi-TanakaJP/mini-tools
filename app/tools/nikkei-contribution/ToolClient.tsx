"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  NikkeiContributionDayData,
  NikkeiContributionPageData,
  NikkeiContributionRankItem,
  NikkeiContributionRecord,
} from "./types";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
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

function sumContribution(items: NikkeiContributionRecord[]) {
  return items.reduce((total, item) => total + item.contribution, 0);
}

type RankingListProps = {
  title: string;
  items: NikkeiContributionRankItem[];
};

function RankingList({ title, items }: RankingListProps) {
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.contribution)), 1);

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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{item.name}</span>
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
              const showLarge = area >= 220;
              const showMedium = !showLarge && area >= 120 && minSide >= 6;
              const showPctOnly = !showLarge && !showMedium && area >= 34;
              const titleSize = showLarge ? Math.min(17, Math.max(10, minSide * 0.72)) : showMedium ? Math.min(12, Math.max(8, minSide * 0.56)) : 0;
              const pctSize = showLarge ? Math.min(14, Math.max(9, minSide * 0.52)) : showMedium ? Math.min(10, Math.max(7, minSide * 0.42)) : showPctOnly ? Math.min(9, Math.max(7, minSide * 0.42)) : 0;
              const nameLabel = showLarge
                ? record.name
                : showMedium
                ? record.name.length > 10
                  ? `${record.name.slice(0, 10)}…`
                  : record.name
                : "";
              const pctColor = record.chg_pct >= 0 ? withAlpha(textColor, "f2") : withAlpha(textColor, "eb");

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
                    padding: showLarge ? 8 : showMedium ? 4 : 2,
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
                    <div style={{ lineHeight: 1.05, display: "grid", gap: 4, alignItems: "center", textShadow: textColor === "#f8fafc" ? "0 1px 1px rgba(15,23,42,0.35)" : "none" }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: titleSize,
                          wordBreak: "break-word",
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

function RecordsTable({ records }: { records: NikkeiContributionRecord[] }) {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
            {["銘柄", "価格", "みなし額面", "ウェイト", "騰落率", "前日比", "寄与度"].map((label) => (
              <th
                key={label}
                style={{
                  padding: "8px 10px",
                  textAlign: label === "銘柄" ? "left" : "right",
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const tone = getBarTone(record.contribution);
            return (
              <tr key={record.code} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "10px" }}>
                  <div style={{ fontWeight: 700 }}>{record.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{record.code}</div>
                </td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>{fmtPrice(record.price)}</td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>{fmtPrice(record.minashi)}</td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>{record.weight_pct.toFixed(2)}%</td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>{fmtPct(record.chg_pct)}</td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>{sign(record.chg)}{fmtNumber(record.chg)}</td>
                <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap", color: tone.text, fontWeight: 800 }}>
                  {fmtPt(record.contribution)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: NikkeiContributionPageData }) {
  const { manifest, initialDayData } = data;
  const [selectedDate, setSelectedDate] = useState<string>(manifest.latest_date ?? "");
  const [loadedDays, setLoadedDays] = useState<Record<string, NikkeiContributionDayData>>(() => {
    if (!initialDayData) return {};
    return { [initialDayData.date]: initialDayData };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"contribution" | "weight_pct" | "chg_pct">("contribution");
  const [selectedCode, setSelectedCode] = useState<string | null>(initialDayData?.records[0]?.code ?? null);

  useEffect(() => {
    if (!selectedDate || loadedDays[selectedDate]) {
      setLoadError(null);
      return;
    }

    let active = true;

    async function loadSelectedDate() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/tools/nikkei-contribution/data/${selectedDate}`);
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
  }, [loadedDays, selectedDate]);

  const dayData = selectedDate ? loadedDays[selectedDate] ?? null : null;
  const sortedRecords = useMemo(() => {
    if (!dayData) return [];
    return [...dayData.records].sort((a, b) => Math.abs(b[sortKey]) - Math.abs(a[sortKey]));
  }, [dayData, sortKey]);
  const selectedRecord = useMemo(() => {
    if (!dayData) return null;
    return dayData.records.find((record) => record.code === selectedCode) ?? dayData.records[0] ?? null;
  }, [dayData, selectedCode]);
  const topWeight = useMemo(() => {
    if (!dayData) return [];
    return [...dayData.records]
      .sort((a, b) => b.weight_pct - a.weight_pct)
      .slice(0, 5);
  }, [dayData]);
  const marketBreadth = dayData?.summary;
  const totalFromRecords = dayData ? sumContribution(dayData.records) : 0;

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
          background: "linear-gradient(135deg, rgba(37,84,255,0.08), rgba(96,165,250,0.03))",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)", minWidth: 40 }}>日付</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={manifest.dates.length === 0}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid var(--color-border-strong)",
              background: "var(--color-bg-card)",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            {manifest.dates.length === 0 ? (
              <option value="">データ準備中</option>
            ) : (
              manifest.dates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))
            )}
          </select>
          {dayData?.market_status ? (
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6 }}>
          <div style={{ background: "var(--color-bg-card)", borderRadius: 10, padding: 14, border: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>合計寄与</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: getBarTone(dayData?.summary.total_contribution ?? 0).text }}>
              {dayData ? fmtPt(dayData.summary.total_contribution) : "-"}
            </div>
          </div>
          <div style={{ background: "var(--color-bg-card)", borderRadius: 10, padding: 14, border: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>上昇 / 下落 / 横ばい</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              {marketBreadth ? `${marketBreadth.advancers} / ${marketBreadth.decliners} / ${marketBreadth.unchanged}` : "-"}
            </div>
          </div>
          <div style={{ background: "var(--color-bg-card)", borderRadius: 10, padding: 14, border: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>全銘柄寄与合計</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: getBarTone(totalFromRecords).text }}>
              {dayData ? fmtPt(totalFromRecords) : "-"}
            </div>
          </div>
          <div style={{ background: "var(--color-bg-card)", borderRadius: 10, padding: 14, border: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>対象銘柄数</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{dayData ? `${dayData.records.length}件` : "-"}</div>
          </div>
        </div>
      </section>

      {loadError ? (
        <div style={{ padding: "20px 0", color: "var(--color-text-muted)" }}>{loadError}</div>
      ) : isLoading && !dayData ? (
        <div style={{ padding: "20px 0", color: "var(--color-text-muted)" }}>読み込み中...</div>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
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
                <div style={{ background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>みなし額面</div>
                  <div style={{ fontWeight: 800 }}>{fmtPrice(selectedRecord.minashi)}</div>
                </div>
              </div>
            </section>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 6 }}>
            <RankingList title="上昇寄与ランキング" items={dayData.top_positive} />
            <RankingList title="下落寄与ランキング" items={dayData.top_negative} />
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
              {topWeight.map((record) => (
                <div key={`weight-${record.code}`} style={{ borderRadius: 6, padding: 12, background: "var(--color-bg-input)", border: "1px solid var(--color-border)" }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{record.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>{record.code}</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{record.weight_pct.toFixed(2)}%</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: getBarTone(record.contribution).text }}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900 }}>全銘柄テーブル</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                  寄与度、ウェイト、騰落率の絶対値で並び替えて確認できます。
                </p>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[
                  ["contribution", "寄与度順"],
                  ["weight_pct", "ウェイト順"],
                  ["chg_pct", "騰落率順"],
                ].map(([key, label]) => {
                  const active = sortKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSortKey(key as typeof sortKey)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: active ? "1.5px solid var(--color-accent)" : "1.5px solid var(--color-border-strong)",
                        background: active ? "var(--color-accent-sub)" : "var(--color-bg-card)",
                        color: active ? "var(--color-accent)" : "var(--color-text-sub)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <RecordsTable records={sortedRecords} />
          </section>

          <p style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
            ※ 表示データは market_info で生成した JSON をもとにしています。投資判断はご自身でご確認ください。
          </p>
        </>
      )}
    </main>
  );
}
