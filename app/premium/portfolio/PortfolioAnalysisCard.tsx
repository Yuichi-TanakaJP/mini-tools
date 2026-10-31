"use client";

import { useRef } from "react";
import { portfolioAllocationDimensions, type PortfolioAllocationDimension, type PortfolioAllocationScope } from "./allocation";
import type { AnalysisGroup } from "./linked-analysis";
import type { PortfolioData } from "./types";
import styles from "./PortfolioAnalysis.module.css";

const classificationDimensions = new Set<PortfolioAllocationDimension>(["sector_33", "cycle_profile", "income_profile", "market_cap_profile"]);
const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const pct = (value: number) => value > 0 && value < 0.1 ? "0.1%未満" : `${value.toFixed(1)}%`;
function color(group: AnalysisGroup, index: number) { return group.isUnclassified ? "var(--color-text-muted)" : group.isOther ? "#758397" : `hsl(${(index * 137.508 + 220) % 360} 70% 62%)`; }
function amount(group: AnalysisGroup) { return group.marketValue === 0 && group.missingValueCount > 0 ? "—" : yen(group.marketValue); }
function compact(value: number) { return value >= 10_000 ? `¥${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value / 10_000)}万` : yen(value); }

export type PortfolioAnalysisCardProps = {
  data: PortfolioData;
  hideControls?: boolean;
  dimension: PortfolioAllocationDimension;
  scope: PortfolioAllocationScope;
  selectedKey: string | null;
  groups: AnalysisGroup[];
  allGroups: AnalysisGroup[];
  total: number;
  onDimension: (dimension: PortfolioAllocationDimension) => void;
  onScope: (scope: PortfolioAllocationScope) => void;
  onSelect: (key: string | null) => void;
};

export default function PortfolioAnalysisCard({ data, hideControls = false, dimension, scope, selectedKey, groups, allGroups, total, onDimension, onScope, onSelect }: PortfolioAnalysisCardProps) {
  const clearRef = useRef<HTMLButtonElement>(null);
  const select = (key: string | null) => {
    if (key === "action:clear") { clearRef.current?.focus(); onSelect(null); }
    else onSelect(key);
  };
  const selected = groups.find((group) => group.key === selectedKey);
  const unavailable = classificationDimensions.has(dimension) && data.instrumentAnalysisStatus === "error";
  const knownCount = allGroups.reduce((sum, group) => sum + group.positionCount - group.missingValueCount, 0);
  const missing = allGroups.reduce((sum, group) => sum + group.missingValueCount, 0);

  const segments = groups.map((group, index) => ({ group, index, offset: groups.slice(0, index).reduce((sum, previous) => sum + previous.percentage, 0) }));
  const scopeName = scope === "all" ? "登録保有全体" : "個別株のみ";
  return <div style={{ display: "grid", gap: 14 }}>
    {!hideControls ? <PortfolioAnalysisControls dimension={dimension} scope={scope} onDimension={onDimension} onScope={onScope} /> : null}
    <div className={styles.context}>
      <span style={{ minWidth: 0 }}>分析対象額 <strong>{knownCount > 0 ? yen(total) : "—"}</strong> ／ {unavailable ? "分類未取得" : `${allGroups.length}分類`}<span title={`${scopeName} ／ ${selected?.label ?? "すべて"}`} style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>表示範囲：{scopeName} ／ {selected?.label ?? "すべて"}</span></span>
      <button ref={clearRef} type="button" className={styles.choice} aria-pressed={!selected} onClick={() => onSelect(null)}>すべて表示</button>
    </div>
    {unavailable ? <div className={styles.chartGrid}><div className={styles.chart} role="status">分類情報を取得できませんでした。資産クラス・口座種別・銘柄別へ切り替えられます。</div><div className={styles.legend} /></div> : <div className={styles.chartGrid}>
      <div className={styles.chart}>
        {total > 0 ? <svg viewBox="0 0 52 52" className={styles.donut} role="img" aria-label={`${portfolioAllocationDimensions[dimension].label} / ${scopeName}。${groups.map((group) => `${group.label} ${pct(group.percentage)}`).join("、")}。選択：${selected?.label ?? "すべて"}`}>
          <circle cx={26} cy={26} r={18} pathLength={100} fill="transparent" stroke="var(--color-bg-input)" strokeWidth={8} />
          {segments.filter(({ group }) => group.percentage > 0).map(({ group, index, offset }) => <circle key={group.key} cx={26} cy={26} r={18} pathLength={100} fill="transparent" stroke={color(group, index)} strokeWidth={8} strokeDasharray={`${group.percentage} ${100 - group.percentage}`} strokeDashoffset={25 - offset} opacity={!selected || selected.key === group.key ? 1 : 0.25}><title>{`${group.label} ${amount(group)} / ${pct(group.percentage)}`}</title></circle>)}
          <text x={26} y={24.7} textAnchor="middle" fontSize={2.8} fontWeight={800} fill="var(--color-text-muted)">{selected ? "選択額" : "分析対象"}</text>
          <text x={26} y={29.5} textAnchor="middle" fontSize={3.4} fontWeight={900} fill="var(--color-text)">{selected && selected.marketValue === 0 && selected.missingValueCount > 0 ? "—" : compact(selected?.marketValue ?? total)}</text>
        </svg> : <p style={{ color: "var(--color-text-muted)" }}>対象範囲に評価額を取得できる保有がありません。</p>}
      </div>
      <div className={styles.legend} role="group" aria-label="分類で絞り込み">
        {groups.map((group, index) => <button key={group.key} type="button" className={styles.legendButton} aria-pressed={selectedKey === group.key} onClick={() => select(selectedKey === group.key ? null : group.key)}>
          <span className={styles.legendName}><span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: "50%", background: color(group, index), flexShrink: 0 }} /><span className={styles.legendText} title={group.label}>{group.label}</span></span>
          <span className={styles.legendValue}><strong>{total > 0 ? pct(group.percentage) : "—"}</strong><br />{amount(group)}{group.missingValueCount > 0 ? "（未取得あり）" : ""}</span>
        </button>)}
      </div>
    </div>}
    {!unavailable ? <details key={`${dimension}:${scope}`}><summary style={{ cursor: "pointer", fontSize: 12 }}>分類の全明細（{allGroups.length}分類）</summary><div role="group" aria-label="すべての分類から選択" style={{ display: "grid", gap: 4, paddingTop: 10 }}>{allGroups.map((group) => <button key={group.key} type="button" className={styles.legendButton} aria-pressed={selectedKey === group.key} onClick={() => select(selectedKey === group.key ? null : group.key)}><span>{group.label}</span><span>{amount(group)}{group.missingValueCount > 0 ? "（未取得あり）" : ""} ／ {total > 0 ? pct(group.percentage) : "—"}</span></button>)}</div></details> : <div style={{ height: 20 }} />}
    <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 11, lineHeight: 1.6 }}>分類ボタンを押すと、下の配当・商品構成も同じ範囲になります。構成比の分母は分析対象全体を維持します。外部参照資産は対象外。未分類も分母に含めます。{missing > 0 ? ` 評価額未取得 ${missing}件はグラフから除外し、商品一覧には残します。` : ""}</p>
  </div>;
}

export function PortfolioAnalysisControls({ dimension, scope, onDimension, onScope }: Pick<PortfolioAnalysisCardProps, "dimension" | "scope" | "onDimension" | "onScope">) {
  return (
<div className={styles.controls}>
    <div role="group" aria-label="分析軸" className={styles.axes}>
      {Object.entries(portfolioAllocationDimensions).map(([key, item]) => <button key={key} type="button" className={styles.choice} aria-pressed={dimension === key} onClick={() => onDimension(key as PortfolioAllocationDimension)}>{item.label}</button>)}
    </div>
    <div role="group" aria-label="分析対象" className={styles.axes}>
      {(["all", "equity"] as const).map((key) => <button key={key} type="button" className={styles.choice} aria-pressed={scope === key} onClick={() => onScope(key)}>{key === "all" ? "登録保有全体" : "個別株のみ"}</button>)}
    </div>
    </div>
  );
}
