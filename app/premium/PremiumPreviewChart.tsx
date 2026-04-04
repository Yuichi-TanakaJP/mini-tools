"use client";

import { useState } from "react";

type PreviewSeries = {
  sectorName: string;
  values: number[];
  color: string;
  latestChange: number;
};

type Props = {
  monthLabel: string;
  dateLabels: string[];
  series: PreviewSeries[];
  defaultSelected: string[];
};

function buildSparklinePoints(
  values: number[],
  width: number,
  axisMin: number,
  axisMax: number
) {
  const height = 180;
  const padding = 14;
  const range = axisMax - axisMin || 1;

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - axisMin) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function fmtPct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function roundUpToStep(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function roundDownToStep(value: number, step: number) {
  return Math.floor(value / step) * step;
}

export default function PremiumPreviewChart({
  monthLabel,
  dateLabels,
  series,
  defaultSelected,
}: Props) {
  const [selectedSectors, setSelectedSectors] = useState<string[]>(defaultSelected);
  const chartWidth = Math.max(560, dateLabels.length * 56);
  const isShowingAll = selectedSectors.length === series.length;

  const selectedSeries = series.filter((item) => selectedSectors.includes(item.sectorName));
  const allValues = selectedSeries.flatMap((item) => item.values);
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 99;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 101;
  const axisMax = roundUpToStep(rawMax, 5);
  const axisMin = roundDownToStep(rawMin, 5);
  const axisRange = Math.max(axisMax - axisMin, 5);
  const guideValues = [axisMax, axisMin + axisRange / 2, axisMin];

  function toggleSector(sectorName: string) {
    setSelectedSectors((current) => {
      if (current.includes(sectorName)) {
        if (current.length === 1) return current;
        return current.filter((name) => name !== sectorName);
      }

      if (current.length >= 6) {
        return [...current.slice(1), sectorName];
      }

      return [...current, sectorName];
    });
  }

  return (
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
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#c2410c",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            業種選択チャート Preview
          </div>
          <h2 style={{ margin: "8px 0 8px", fontSize: 24 }}>
            {monthLabel}の月初を100にして、業種ごとの流れを比べる
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            月内の最初の営業日を100に固定し、そこから日々の変動を積み上げる形にしています。
            初期表示は代表業種だけに絞りつつ、比較したい業種を追加できる方が premium の体験として分かりやすいです。
          </p>
        </div>

        <div
          style={{
            minWidth: 160,
            background: "#0f172a",
            color: "#fff",
            borderRadius: 18,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>表示ルール</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{monthLabel} 月初 = 100</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>
            最大6業種まで比較
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSelectedSectors(series.map((item) => item.sectorName))}
            aria-pressed={isShowingAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 999,
              border: isShowingAll
                ? "1px solid #1d4ed8"
                : "1px solid var(--color-border)",
              background: isShowingAll ? "#dbeafe" : "#fff",
              color: isShowingAll ? "#1e3a8a" : "var(--color-text-sub)",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: isShowingAll ? "inset 0 0 0 1px rgba(37, 99, 235, 0.08)" : "none",
              transition: "all 120ms ease",
            }}
          >
            全部表示
          </button>
          {series.map((item) => {
            const active = selectedSectors.includes(item.sectorName);
            return (
              <button
                key={item.sectorName}
                type="button"
                onClick={() => toggleSector(item.sectorName)}
                aria-pressed={active}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 999,
                  border: active
                    ? `1px solid ${item.color}`
                    : "1px solid var(--color-border)",
                  background: active ? "#dbeafe" : "#fff",
                  color: active ? "#1e3a8a" : "var(--color-text-sub)",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: active ? "inset 0 0 0 1px rgba(37, 99, 235, 0.08)" : "none",
                  transition: "all 120ms ease",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: item.color,
                    display: "inline-block",
                  }}
                />
                {item.sectorName}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <span>選択中: {selectedSectors.length} / {series.length} 業種</span>
          <span>
            {dateLabels.length}営業日分を月初100で表示。個別選択は最大6業種、全部表示にも切り替えられます。
          </span>
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
          borderRadius: 22,
          border: "1px solid rgba(37, 84, 255, 0.10)",
          padding: "18px 14px 14px",
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: chartWidth }}>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <div
              style={{
                width: 46,
                height: 180,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "flex-end",
                fontSize: 12,
                color: "var(--color-text-muted)",
                paddingTop: 4,
                paddingBottom: 4,
                flexShrink: 0,
              }}
            >
              <span>{axisMax.toFixed(1)}</span>
              <span style={{ color: "#1d4ed8", fontWeight: 800 }}>
                {(axisMin + axisRange / 2).toFixed(1)}
              </span>
              <span>{axisMin.toFixed(1)}</span>
            </div>
            <svg
              viewBox={`0 0 ${chartWidth} 180`}
              width="100%"
              height="180"
              aria-label="業種比較チャート"
              style={{ display: "block", flex: 1 }}
            >
              <rect x="0" y="0" width={chartWidth} height="180" rx="16" fill="transparent" />
              {guideValues.map((guideValue) => {
                const y =
                  180 - 14 - ((guideValue - axisMin) / axisRange) * (180 - 14 * 2);
                const isHundredLine = Math.abs(guideValue - 100) < 0.001;
                return (
                <line
                  key={guideValue}
                  x1="14"
                  y1={y}
                  x2={chartWidth - 14}
                  y2={y}
                  stroke={
                    isHundredLine
                      ? "rgba(37, 84, 255, 0.30)"
                      : "rgba(148, 163, 184, 0.26)"
                  }
                  strokeDasharray={isHundredLine ? "0" : "4 6"}
                />
                );
              })}
              {selectedSeries.map((item) => (
                <polyline
                  key={item.sectorName}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildSparklinePoints(item.values, chartWidth, axisMin, axisMax)}
                  style={{ cursor: "pointer" }}
                />
              ))}
              {selectedSeries.map((item) => (
                <polyline
                  key={`${item.sectorName}-hover`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildSparklinePoints(item.values, chartWidth, axisMin, axisMax)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{item.sectorName}</title>
                </polyline>
              ))}
            </svg>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${dateLabels.length}, minmax(0, 1fr))`,
              gap: 8,
              fontSize: 11,
              color: "var(--color-text-muted)",
              marginTop: 2,
            }}
          >
            {dateLabels.map((label) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        {selectedSeries.map((item) => (
          <div
            key={item.sectorName}
            style={{
              borderRadius: 16,
              border: "1px solid var(--color-border)",
              background: "#fff",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: item.color,
                  display: "inline-block",
                }}
              />
              {item.sectorName}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
              {item.values[item.values.length - 1]?.toFixed(1)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: item.latestChange >= 0 ? "#166534" : "#991b1b",
                fontWeight: 800,
              }}
            >
              最新日の騰落率 {fmtPct(item.latestChange)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
