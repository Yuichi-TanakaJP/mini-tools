"use client";

import { useMemo, useState, type ReactNode } from "react";
import { aggregatePortfolioPositions } from "./aggregates";
import { portfolioAllocationDimensions, type PortfolioAllocationDimension, type PortfolioAllocationScope } from "./allocation";
import { buildAnalysisGroups, resolveAnalysisSelection, selectDividendProjection } from "./linked-analysis";
import PortfolioAnalysisCard, { PortfolioAnalysisControls } from "./PortfolioAnalysisCard";
import PortfolioDividend from "./PortfolioDividend";
import PortfolioDividendComposition from "./PortfolioDividendComposition";
import PortfolioSummaryCards from "./PortfolioSummaryCards";
import { activeSummary, selectionForSummary, type AnalysisSelection, type SummaryTarget } from "./summary-selection";
import type { PortfolioData } from "./types";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
const classifications = new Set<PortfolioAllocationDimension>(["sector_33", "cycle_profile", "income_profile", "market_cap_profile"]);
function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}><h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{title}</h2>{children}</section>;
}

export default function PortfolioHoldingsAnalysis({ data }: { data: PortfolioData }) {
  const [content, setContent] = useState<"assets" | "dividends">("assets");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [selection, setSelection] = useState<AnalysisSelection>(selectionForSummary("assets"));
  const model = useMemo(() => buildAnalysisGroups(data.positions, data.instrumentAnalysis, selection.dimension, selection.scope), [data.positions, data.instrumentAnalysis, selection.dimension, selection.scope]);
  const unavailable = classifications.has(selection.dimension) && data.instrumentAnalysisStatus === "error";
  const resolved = useMemo(() => resolveAnalysisSelection(model, unavailable ? null : selection.key), [model, unavailable, selection.key]);
  const selected = resolved.selected;
  const active = activeSummary(content, { ...selection, key: selected?.key ?? null });
  const selectSummary = (target: SummaryTarget) => {
    const next = selectionForSummary(target);
    if (target === active && selection.dimension === next.dimension && selection.scope === next.scope && selection.key === next.key) return;
    setContent(target === "dividends" ? "dividends" : "assets");
    setSelection(next);
  };
  const visibleGroups = useMemo(() => selected ? [selected] : model.visible, [selected, model.visible]);
  const selectedPositions = useMemo(() => (selected ? selected.positions : model.all.flatMap((group) => group.positions)), [selected, model.all]);
  const projection = useMemo(() => selectDividendProjection(data.domesticDividends, data.positions, selectedPositions), [data.domesticDividends, data.positions, selectedPositions]);
  const dividendGroups = useMemo(() => visibleGroups.map((group) => ({ group, projection: selectDividendProjection(data.domesticDividends, data.positions, group.positions) })), [data.domesticDividends, data.positions, visibleGroups]);
  const scopeLabel = `${selection.scope === "equity" ? "個別株のみ" : "登録保有全体"} ／ ${portfolioAllocationDimensions[selection.dimension].label} ／ ${selected?.label ?? "すべて"}`;
  const selectedTotal = selected?.marketValue ?? model.total;
  const choose = (key: string | null) => setSelection((current) => ({ ...current, key: key === "action:clear" || current.key === key ? null : key }));
  const productGroups = unavailable ? [{ key: "unavailable", label: "登録保有（分類取得失敗）", positions: selectedPositions, missingValueCount: selectedPositions.filter((p) => p.marketValue === null).length }] : visibleGroups;
  return <div style={{ display: "grid", gap: 16 }}>
    <div><p className={styles.controlLabel} style={{ margin: "0 0 8px" }}>表示する内容</p><PortfolioSummaryCards data={data} active={active} onSelect={selectSummary} /></div>
    <Card title={content === "dividends" ? "配当を見る" : "資産を見る"}>
      <div className={styles.viewControls}>
        <div className={styles.labeledControls}><span className={styles.controlLabel}>表示形式</span><div role="group" aria-label="表示形式" className={styles.axes}>{(["graph", "list"] as const).map((mode) => <button type="button" key={mode} className={styles.choice} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === "graph" ? "グラフ" : "一覧"}</button>)}</div></div>
        <button type="button" className={styles.choice} aria-pressed={!selected} onClick={() => choose(null)}>絞り込みを解除</button>
      </div>
      <div className={styles.filterControls}><span className={styles.controlLabel}>分類条件</span>
      <PortfolioAnalysisControls dimension={selection.dimension} scope={selection.scope}
        onDimension={(dimension) => setSelection((current) => current.dimension === dimension ? current : ({ ...current, dimension, key: null }))}
        onScope={(scope) => setSelection((current) => current.scope === scope ? current : ({ ...current, scope, key: null }))} />
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-sub)", lineHeight: 1.6 }}>表示範囲：{scopeLabel}。グラフ・一覧は登録保有が対象です（外部参照資産を除く）。上部金額は各カードの保有全体です。</p>
      {view === "graph" ? <div className={content === "assets" ? styles.comparisonGrid : undefined}>
      {content === "assets" ? <>
      <section aria-label="評価額の構成"><h3 style={{ fontSize: 16, margin: "0 0 10px" }}>資産評価額の構成</h3>
      <PortfolioAnalysisCard hideControls data={data} dimension={selection.dimension} scope={selection.scope} selectedKey={selected?.key ?? null} groups={resolved.chartGroups} allGroups={model.all} total={model.total}
        onDimension={(dimension) => setSelection((current) => current.dimension === dimension ? current : ({ ...current, dimension, key: null }))}
        onScope={(scope) => setSelection((current) => current.scope === scope ? current : ({ ...current, scope, key: null }))} onSelect={choose} />
      </section></> : null}
      <section aria-label="配当額の構成">
        {projection?.status === "error" ? <p role="status">配当データの取得に失敗しました。金額は未確認です。</p> : !projection || projection.status === "no_snapshot" ? <p role="status">配当データは未取得です。</p> : projection.status === "no_domestic_stocks" ? <p role="status">この範囲に配当対象の国内個別株はありません。</p> : null}{!unavailable && dividendGroups.length > 0 ? <PortfolioDividendComposition groups={dividendGroups} projection={projection} dimensionLabel={portfolioAllocationDimensions[selection.dimension].label} selectedKey={selected?.key ?? null} onSelect={choose} /> : <p role="status">{unavailable ? "分類情報を取得できないため、配当の分類グラフは保留しています。他の軸へ切り替えられます。" : "対象の保有がありません。"}</p>}</section>
      </div> : null}
    </Card>
    <div role="status" aria-live="polite" style={{ fontSize: 13, color: "var(--color-text-sub)", lineHeight: 1.6 }}>配当・商品構成の表示範囲：<strong>{scopeLabel}</strong>。上段の総資産評価額・年間予想配当は保有全体です。</div>
    {view === "list" && content === "dividends" ? <PortfolioDividend projection={projection} scopeLabel={scopeLabel} expandDetails /> : null}
    {view === "list" && content === "assets" ? <Card title="商品一覧">
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
            <div style={{ marginTop: 5, color: "var(--color-text-sub)", fontSize: 11 }}>数量：{group.positions.filter((p) => p.instrumentId === item.instrumentId).every((p) => p.quantityKnown === true) ? number(item.quantity) : "—"} ／ 取得額：{yen(item.costBasis)} ／ 損益：{yen(item.unrealizedPnl)}</div>
            <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>口座：{item.accounts.join(" ／ ")}</div>
          </div>;
        })}</div>
      </section>)}</div>}
    </Card> : null}
  </div>;
}
