"use client";

import { useMemo, useState, type ReactNode } from "react";
import { aggregatePortfolioPositions } from "./aggregates";
import { portfolioAllocationDimensions, type PortfolioAllocationDimension, type PortfolioAllocationScope } from "./allocation";
import { buildAnalysisGroups, resolveAnalysisSelection, selectDividendProjection } from "./linked-analysis";
import PortfolioAnalysisCard from "./PortfolioAnalysisCard";
import PortfolioDividend from "./PortfolioDividend";
import type { PortfolioData } from "./types";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
const classifications = new Set<PortfolioAllocationDimension>(["sector_33", "cycle_profile", "income_profile", "market_cap_profile"]);
function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}><h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{title}</h2>{children}</section>;
}

export default function PortfolioHoldingsAnalysis({ data }: { data: PortfolioData }) {
  const [selection, setSelection] = useState<{ dimension: PortfolioAllocationDimension; scope: PortfolioAllocationScope; key: string | null }>({ dimension: "sector_33", scope: "equity", key: null });
  const model = useMemo(() => buildAnalysisGroups(data.positions, data.instrumentAnalysis, selection.dimension, selection.scope), [data.positions, data.instrumentAnalysis, selection.dimension, selection.scope]);
  const unavailable = classifications.has(selection.dimension) && data.instrumentAnalysisStatus === "error";
  const resolved = useMemo(() => resolveAnalysisSelection(model, unavailable ? null : selection.key), [model, unavailable, selection.key]);
  const selected = resolved.selected;
  const visibleGroups = useMemo(() => selected ? [selected] : model.visible, [selected, model.visible]);
  const selectedPositions = useMemo(() => (selected ? selected.positions : model.all.flatMap((group) => group.positions)), [selected, model.all]);
  const projection = useMemo(() => selectDividendProjection(data.domesticDividends, data.positions, selectedPositions), [data.domesticDividends, data.positions, selectedPositions]);
  const dividendGroups = useMemo(() => visibleGroups.map((group) => ({ group, projection: selectDividendProjection(data.domesticDividends, data.positions, group.positions) })), [data.domesticDividends, data.positions, visibleGroups]);
  const scopeLabel = `${selection.scope === "equity" ? "個別株のみ" : "登録保有全体"} ／ ${portfolioAllocationDimensions[selection.dimension].label} ／ ${selected?.label ?? "すべて"}`;
  const selectedTotal = selected?.marketValue ?? model.total;
  const choose = (key: string | null) => setSelection((current) => ({ ...current, key: key === "action:clear" || current.key === key ? null : key }));
  const productGroups = unavailable ? [{ key: "unavailable", label: "登録保有（分類取得失敗）", positions: selectedPositions, missingValueCount: selectedPositions.filter((p) => p.marketValue === null).length }] : visibleGroups;
  return <div style={{ display: "grid", gap: 16 }}>
    <Card title="保有資産の構成">
      <PortfolioAnalysisCard data={data} dimension={selection.dimension} scope={selection.scope} selectedKey={selected?.key ?? null} groups={resolved.chartGroups} allGroups={model.all} total={model.total}
        onDimension={(dimension) => setSelection((current) => current.dimension === dimension ? current : ({ ...current, dimension, key: null }))}
        onScope={(scope) => setSelection((current) => current.scope === scope ? current : ({ ...current, scope, key: null }))} onSelect={choose} />
    </Card>
    <div role="status" aria-live="polite" style={{ fontSize: 13, color: "var(--color-text-sub)", lineHeight: 1.6 }}>配当・商品構成の表示範囲：<strong>{scopeLabel}</strong>。上段の総資産評価額は保有全体です。</div>
    <PortfolioDividend projection={projection} scopeLabel={scopeLabel} breakdown={!unavailable && dividendGroups.length > 1 ? <div aria-label="分類別の予想配当" style={{ display: "grid", gap: 6 }}>
      <h3 style={{ margin: "0 0 3px", fontSize: 14 }}>{portfolioAllocationDimensions[selection.dimension].label}別の配当</h3>
      {dividendGroups.map(({ group, projection: item }) => <button key={group.key} className={styles.legendButton} type="button" aria-pressed={selected?.key === group.key} onClick={() => choose(group.key)}>
        <span>{group.label}</span><span style={{ textAlign: "right", fontSize: 12 }}>{item?.status === "no_domestic_stocks" ? "対象国内株なし" : item?.status === "ready" ? yen(item.projectedAnnualGross) : "未確定"}<br /><span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{item ? `${item.coveredStocks}/${item.expectedStocks}銘柄` : "未取得"}</span></span>
      </button>)}
    </div> : undefined} />
    <Card title="商品構成">
      <p style={{ margin: "0 0 14px", color: "var(--color-text-muted)", fontSize: 12 }}>表示範囲：{scopeLabel} ／ 構成比はこの範囲の既知評価額を分母にしています。口座別の数量・金額も選択範囲だけです。</p>
      {unavailable ? <p role="status">分類別の表示は保留しています。商品明細は表示できます。</p> : null}
      {productGroups.length === 0 ? <p>対象の商品がありません。</p> : <div style={{ display: "grid", gap: 20 }}>{productGroups.map((group) => <section key={group.key} aria-label={`${group.label}の商品`}>
        <button type="button" className={styles.choice} onClick={() => { if (!unavailable) choose(group.key); }} aria-pressed={selected?.key === group.key} disabled={unavailable}>{group.label}</button>
        {group.missingValueCount > 0 ? <p style={{ color: "var(--color-text-muted)", fontSize: 11 }}>評価額未取得 {group.missingValueCount}件を含みます。</p> : null}
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{aggregatePortfolioPositions(group.positions).map((item) => {
          const percent = selectedTotal > 0 && item.marketValue !== null ? item.marketValue / selectedTotal * 100 : null;
          return <div key={item.instrumentId} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13 }}><span><strong>{item.identifier}</strong> {item.name}</span><span style={{ fontWeight: 800 }}>{yen(item.marketValue)} ／ {percent === null ? "—" : `${percent.toFixed(1)}%`}</span></div>
            {percent !== null ? <div style={{ height: 7, marginTop: 6, borderRadius: 999, background: "var(--color-bg-input)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.max(0, percent))}%`, background: "var(--color-accent)" }} /></div> : null}
            <div style={{ marginTop: 5, color: "var(--color-text-sub)", fontSize: 11 }}>数量：{number(item.quantity)} ／ 取得額：{yen(item.costBasis)} ／ 損益：{yen(item.unrealizedPnl)}</div>
            <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>口座：{item.accounts.join(" ／ ")}</div>
          </div>;
        })}</div>
      </section>)}</div>}
    </Card>
  </div>;
}
