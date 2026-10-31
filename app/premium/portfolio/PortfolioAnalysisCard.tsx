"use client";

import { useMemo, useState } from "react";
import {
  getPortfolioAllocation,
  portfolioAllocationDimensions,
  type PortfolioAllocationDimension,
  type PortfolioAllocationItem,
  type PortfolioAllocationScope,
} from "./allocation";
import type { PortfolioData } from "./types";

function itemColor(item: PortfolioAllocationItem, index: number) {
  return item.isUnclassified ? "var(--color-text-muted)" : `hsl(${(index * 137.508 + 220) % 360} 70% 62%)`;
}
const classificationDimensions = new Set<PortfolioAllocationDimension>(["sector_33", "cycle_profile", "income_profile", "market_cap_profile"]);

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
}

function formatCompactYen(value: number) {
  if (value >= 1_000_000) return `¥${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value / 1_000_000)}M`;
  if (value >= 10_000) return `¥${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value / 10_000)}万`;
  return formatYen(value);
}

function DonutChart({ items, total, label }: { items: PortfolioAllocationItem[]; total: number; label: string }) {
  const radius = 18;
  const segments = items.reduce<Array<{ item: PortfolioAllocationItem; index: number; offset: number }>>((result, item, index) => {
    const previous = result.at(-1);
    const offset = previous ? previous.offset + previous.item.percentage : 0;
    return [...result, { item, index, offset }];
  }, []);
  return (
    <svg viewBox="0 0 52 52" width={220} height={220} role="img" aria-label={label + "。" + items.map((item) => `${item.label} ${formatPercent(item.percentage)}`).join("、")} style={{ maxWidth: "100%" }}>
      <circle cx={26} cy={26} r={radius} pathLength={100} fill="transparent" stroke="var(--color-bg-input)" strokeWidth={8} />
      {segments.map(({ item, index, offset: segmentOffset }) => (
        <circle key={item.key} cx={26} cy={26} r={radius} pathLength={100} fill="transparent" stroke={itemColor(item, index)} strokeWidth={8} strokeDasharray={`${item.percentage} ${100 - item.percentage}`} strokeDashoffset={25 - segmentOffset}>
          <title>{`${item.label} ${formatYen(item.marketValue)} / ${formatPercent(item.percentage)}`}</title>
        </circle>
      ))}
      <text x={26} y={24.7} textAnchor="middle" fontSize={3.2} fontWeight={800} fill="var(--color-text-muted)">分析対象</text>
      <text x={26} y={29.5} textAnchor="middle" fontSize={3.8} fontWeight={900} fill="var(--color-text)">{formatCompactYen(total)}</text>
    </svg>
  );
}

export default function PortfolioAnalysisCard({ data }: { data: PortfolioData }) {
  const [dimension, setDimension] = useState<PortfolioAllocationDimension>("sector_33");
  const [scope, setScope] = useState<PortfolioAllocationScope>("equity");
  const allocation = useMemo(() => getPortfolioAllocation({
    positions: data.positions,
    instrumentAnalysis: data.instrumentAnalysis,
    dimension,
    scope,
  }), [data.instrumentAnalysis, data.positions, dimension, scope]);
  const classificationUnavailable = classificationDimensions.has(dimension) && data.instrumentAnalysisStatus === "error";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, minWidth: "min(220px, 100%)", fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
          分析軸
          <select value={dimension} onChange={(event) => setDimension(event.target.value as PortfolioAllocationDimension)} style={{ minHeight: 40, border: "1px solid var(--color-border)", borderRadius: 8, padding: "0 10px", background: "var(--color-bg-card)", color: "var(--color-text)", fontWeight: 800 }}>
            {Object.entries(portfolioAllocationDimensions).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>分析対象</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "equity"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value} style={{ minHeight: 40, border: scope === value ? "1px solid var(--color-accent)" : "1px solid var(--color-border)", borderRadius: 8, padding: "0 12px", background: scope === value ? "var(--color-info-bg)" : "var(--color-bg-card)", color: scope === value ? "var(--color-info-text)" : "var(--color-text-sub)", fontWeight: 800, cursor: "pointer" }}>
                {value === "all" ? "登録保有全体" : "個別株のみ"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {classificationUnavailable ? (
        <div style={{ borderRadius: 8, padding: 12, background: "var(--color-warning-bg)", color: "var(--color-warning-text)", lineHeight: 1.7 }}>分類情報を取得できませんでした。資産クラス・口座種別・銘柄別の分析は引き続き利用できます。</div>
      ) : allocation.totalMarketValue <= 0 ? (
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>対象範囲に評価額を取得できる保有がありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", color: "var(--color-text-sub)", fontSize: 13 }}>
            <span>分析対象額 <strong style={{ color: "var(--color-text)" }}>{formatYen(allocation.totalMarketValue)}</strong></span>
            <span>{allocation.items.length}分類</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 22, alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><DonutChart items={allocation.items} total={allocation.totalMarketValue} label={`${portfolioAllocationDimensions[dimension].label} / ${scope === "equity" ? "個別株のみ" : "登録保有全体"}`} /></div>
            <div style={{ display: "grid", gap: 10, maxHeight: 350, overflowY: "auto" }} tabIndex={0} role="region" aria-label="構成比の凡例">
                {allocation.items.map((item, index) => (
                  <div key={item.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: 9 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800 }}><span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: "50%", background: itemColor(item, index) }} />{item.label}</span>
                    <span style={{ textAlign: "right" }}><strong>{formatPercent(item.percentage)}</strong><br /><span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{formatYen(item.marketValue)}</span></span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ color: "var(--color-text-muted)", fontSize: 11, lineHeight: 1.6 }}>
        登録保有の評価額ベース（外部参照資産は対象外）。個別株のみは国内株・海外株を含みます。未分類も分母に含めます。{allocation.missingMarketValueCount > 0 ? ` 評価額未取得 ${allocation.missingMarketValueCount}件は構成比から除外しています。` : ""}
      </div>
    </div>
  );
}
