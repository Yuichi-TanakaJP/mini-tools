"use client";

import { useMemo, useState } from "react";
import type { PortfolioData, PortfolioPosition, PortfolioReviewItem } from "./types";
import { summarizePortfolioDbResult } from "./db-check";

type Tab = "overview" | "record" | "policy" | "db";

const tabLabels: Record<Tab, string> = {
  overview: "表示",
  record: "記録",
  policy: "方針",
  db: "DB確認",
};

const accountLabels: Record<string, string> = {
  taxable: "課税口座",
  nisa_growth: "NISA成長投資枠",
  nisa_accumulation: "NISAつみたて投資枠",
  legacy_nisa: "旧つみたてNISA",
  pension: "年金",
  other: "その他",
};

const stanceLabels: Record<string, string> = {
  add_candidate: "買い増し候補",
  dip_wait: "押し目待ち",
  hold: "保有継続",
  reduce_candidate: "縮小候補",
  exit_candidate: "売却候補",
};

const needLabels: Record<string, string> = {
  increase: "増やす意味あり",
  maintain: "現状維持",
  decrease: "比率を下げる",
  not_needed: "追加不要",
};

function formatYen(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null, digits = 0) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function sumNullable(values: Array<number | null>) {
  if (values.every((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function groupPositions(positions: PortfolioPosition[]) {
  const groups = new Map<string, {
    identifier: string;
    name: string;
    assetType: string;
    quantity: number;
    marketValue: number | null;
    costBasis: number | null;
    unrealizedPnl: number | null;
    accounts: string[];
  }>();

  for (const position of positions) {
    const key = `${position.assetType}:${position.identifier}`;
    const current = groups.get(key) ?? {
      identifier: position.identifier,
      name: position.name,
      assetType: position.assetType,
      quantity: 0,
      marketValue: 0,
      costBasis: 0,
      unrealizedPnl: 0,
      accounts: [],
    };
    current.quantity += position.quantity;
    current.marketValue = current.marketValue === null || position.marketValue === null
      ? null
      : current.marketValue + position.marketValue;
    current.costBasis = current.costBasis === null || position.costBasis === null
      ? null
      : current.costBasis + position.costBasis;
    current.unrealizedPnl = current.unrealizedPnl === null || position.unrealizedPnl === null
      ? null
      : current.unrealizedPnl + position.unrealizedPnl;
    if (!current.accounts.includes(position.accountName)) current.accounts.push(position.accountName);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.7 }}>{children}</p>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14, background: "#fbfdff" }}>
      <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 7, fontSize: 24, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 5, color: "var(--color-text-muted)", fontSize: 11 }}>{sub}</div>
    </div>
  );
}

function PositionTable({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) return <EmptyState>このスナップショットにはポジションがありません。</EmptyState>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--color-text-muted)", fontSize: 11 }}>
            {['商品', '口座', '数量', '取得単価', '現在値', '取得額', '評価額', '損益'].map((label) => (
              <th key={label} style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id}>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ fontWeight: 900 }}>{position.identifier}</div>
                <div style={{ marginTop: 3, color: "var(--color-text-sub)" }}>{position.name}</div>
              </td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                <div>{position.accountName}</div>
                <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{accountLabels[position.accountType] ?? position.accountType}</div>
              </td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatNumber(position.quantity, 2)}</td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatYen(position.unitCost)}</td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatYen(position.quotedPrice)}</td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatYen(position.costBasis)}</td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)", fontWeight: 800 }}>{formatYen(position.marketValue)}</td>
              <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)", color: (position.unrealizedPnl ?? 0) >= 0 ? "#166534" : "#991b1b", fontWeight: 800 }}>{formatYen(position.unrealizedPnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyItem({ item }: { item: PortfolioReviewItem }) {
  return (
    <li style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 13, display: "grid", gap: 7 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        {item.priorityRank ? <span style={{ fontWeight: 900, color: "var(--color-accent)" }}>#{item.priorityRank}</span> : null}
        <strong>{item.identifier} {item.name}</strong>
        {item.stance ? <span style={{ borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{stanceLabels[item.stance] ?? item.stance}</span> : null}
        {item.portfolioNeed ? <span style={{ borderRadius: 999, background: "#f8fafc", color: "#475569", padding: "3px 8px", fontSize: 11, fontWeight: 800 }}>{needLabels[item.portfolioNeed] ?? item.portfolioNeed}</span> : null}
      </div>
      {item.roleLabels.length > 0 ? <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>役割: {item.roleLabels.join(" / ")}</div> : null}
      {item.targetAllocationPct !== null || item.proposedNewCapitalAmount !== null ? (
        <div style={{ color: "var(--color-text-sub)", fontSize: 12 }}>
          {item.targetAllocationPct !== null ? `目標配分 ${formatNumber(item.targetAllocationPct, 1)}%` : null}
          {item.targetAllocationPct !== null && item.proposedNewCapitalAmount !== null ? " / " : null}
          {item.proposedNewCapitalAmount !== null ? `追加資金 ${formatYen(item.proposedNewCapitalAmount)}` : null}
        </div>
      ) : null}
      {item.buyConditions.length > 0 ? <div style={{ color: "var(--color-text-sub)", fontSize: 12 }}>買い増し条件: {item.buyConditions.join("、")}</div> : null}
      {item.rationale ? <div style={{ color: "var(--color-text-sub)", fontSize: 12, lineHeight: 1.6 }}>理由: {item.rationale}</div> : null}
      {item.policyNote ? <div style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>方針メモ: {item.policyNote}</div> : null}
    </li>
  );
}

function DbValue({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <span style={{ color: muted ? "var(--color-text-muted)" : "var(--color-text-sub)", wordBreak: "break-word" }}>{children}</span>;
}

function DbStatus({ state }: { state: "auth_required" | "empty" | "no_ready_snapshot" | "loaded" }) {
  const label = state === "loaded" ? "読み込み済み" : state === "empty" ? "未取込" : state === "no_ready_snapshot" ? "ready snapshotなし" : "認証が必要";
  const colors = state === "loaded"
    ? { background: "#dcfce7", color: "#166534" }
    : state === "empty"
      ? { background: "#fef3c7", color: "#92400e" }
      : state === "no_ready_snapshot"
        ? { background: "#fef3c7", color: "#92400e" }
      : { background: "#fee2e2", color: "#991b1b" };
  return <span style={{ borderRadius: 999, padding: "4px 9px", background: colors.background, color: colors.color, fontSize: 12, fontWeight: 900 }}>{label}</span>;
}

function DbCheckView({ data }: { data: PortfolioData }) {
  const summary = useMemo(() => summarizePortfolioDbResult(data), [data]);
  const rows = [
    ["portfolio", summary.portfolioId ? 1 : 0, summary.portfolioName ?? "未作成"],
    ["portfolio_snapshots", summary.snapshotCount, summary.currentSnapshotId ? `current: ${summary.currentSnapshotId}` : "ready snapshotなし"],
    ["portfolio_positions", summary.positionCount, `${summary.instrumentCount}商品 / ${summary.accountCount}口座`],
    ["portfolio_reviews", summary.reviewCount, summary.reviewId ?? "reviewなし"],
    ["portfolio_review_items", summary.reviewItemCount, summary.reviewStatus ?? "reviewなし"],
  ] as const;

  return (
    <>
      <Section title="DB読み取り結果">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <DbStatus state={summary.loadState} />
            <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Supabaseから取得した値の確認用。画面からDBへの保存・更新は行いません。</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Metric label="portfolio" value={summary.portfolioId ? "1件" : "0件"} sub={summary.portfolioName ?? "未作成"} />
            <Metric label="ready snapshot" value={summary.currentSnapshotId ? "1件" : "0件"} sub={summary.currentSnapshotStatus ?? "なし"} />
            <Metric label="position" value={`${summary.positionCount}件`} sub={`${summary.instrumentCount}商品`} />
            <Metric label="review item" value={`${summary.reviewItemCount}件`} sub={summary.reviewStatus === "finalized" ? "確定review" : summary.reviewStatus === "draft" ? "下書きreview" : "reviewなし"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, fontSize: 13 }}>
            <div><strong>portfolio ID</strong><br /><DbValue muted={!summary.portfolioId}>{summary.portfolioId ?? "—"}</DbValue></div>
            <div><strong>最新snapshot ID</strong><br /><DbValue muted={!summary.currentSnapshotId}>{summary.currentSnapshotId ?? "—"}</DbValue></div>
            <div><strong>review ID</strong><br /><DbValue muted={!summary.reviewId}>{summary.reviewId ?? "—"}</DbValue></div>
            <div><strong>基準日</strong><br /><DbValue muted={!summary.currentSnapshotAsOf}>{formatDateTime(summary.currentSnapshotAsOf)}</DbValue></div>
          </div>
        </div>
      </Section>

      <Section title="テーブル別の確認結果">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-text-muted)", fontSize: 11 }}>
                <th style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>対象</th>
                <th style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>件数</th>
                <th style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>補足</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([table, count, note]) => (
                <tr key={table}>
                  <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{table}</td>
                  <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)", fontWeight: 900 }}>{count}</td>
                  <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-sub)" }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="DBから読み取った最新ポジション">
        {data.currentSnapshot ? <PositionTable positions={data.positions} /> : <EmptyState>ready状態のスナップショットがないため、ポジション明細は表示していません。</EmptyState>}
      </Section>
    </>
  );
}

export default function PortfolioWorkspace({ data }: { data: PortfolioData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const grouped = useMemo(() => groupPositions(data.positions), [data.positions]);
  const totalValue = sumNullable(data.positions.map((position) => position.marketValue));
  const totalCost = sumNullable(data.positions.map((position) => position.costBasis));
  const totalPnl = sumNullable(data.positions.map((position) => position.unrealizedPnl));
  const pnlRate = totalCost && totalPnl !== null ? (totalPnl / totalCost) * 100 : null;

  if (data.authState === "required") {
    return (
      <Section title="Supabaseログインが必要です">
        <EmptyState>このポートフォリオはSupabaseのログインユーザー単位で表示します。先に <a href="/account">アカウント</a> へログインしてください。</EmptyState>
      </Section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "#102033", color: "#fff", borderRadius: 12, padding: "22px 20px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800 }}>Portfolio</div>
            <h1 style={{ margin: "7px 0 0", fontSize: 30 }}>ポートフォリオ</h1>
          </div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, textAlign: "right" }}>
            <div>{data.portfolio.name ?? "ポートフォリオ未作成"}</div>
            <div style={{ marginTop: 4 }}>{data.currentSnapshot ? `基準日 ${formatDate(data.currentSnapshot.asOf)}` : "CSV未取込"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(tabLabels) as Tab[]).map((key) => (
            <button key={key} type="button" onClick={() => setTab(key)} style={{ border: tab === key ? "1px solid #bfdbfe" : "1px solid rgba(255,255,255,0.2)", borderRadius: 999, background: tab === key ? "#eff6ff" : "transparent", color: tab === key ? "#1d4ed8" : "#fff", padding: "8px 14px", fontWeight: 800, cursor: "pointer" }}>
              {tabLabels[key]}
            </button>
          ))}
        </div>
      </section>

      {data.source === "empty" ? (
        <Section title="ポートフォリオデータはまだありません">
          <EmptyState>証券会社CSVをstock-notesの取込APIへ送ると、ここに最新スナップショットが表示されます。既存のmy-stocksデータはこの画面へ自動コピーせず、取込履歴を正本として管理します。</EmptyState>
        </Section>
      ) : null}

      {tab === "overview" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Metric label="評価額" value={formatYen(totalValue)} sub="最新readyスナップショット" />
            <Metric label="取得額" value={formatYen(totalCost)} sub={`${grouped.length}商品`} />
            <Metric label="含み損益" value={formatYen(totalPnl)} sub={pnlRate === null ? "損益率 —" : `損益率 ${formatNumber(pnlRate, 2)}%`} />
            <Metric label="ポジション" value={`${data.positions.length}件`} sub={`${data.snapshots.length}件の取込履歴`} />
          </div>
          <Section title="商品別の構成">
            {grouped.length === 0 ? <EmptyState>商品データがありません。</EmptyState> : (
              <div style={{ display: "grid", gap: 12 }}>
                {grouped.map((item) => {
                  const percent = totalValue && item.marketValue !== null ? (item.marketValue / totalValue) * 100 : 0;
                  return (
                    <div key={`${item.assetType}:${item.identifier}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                        <span><strong>{item.identifier}</strong> {item.name}</span>
                        <span style={{ fontWeight: 800 }}>{formatYen(item.marketValue)} / {formatNumber(percent, 1)}%</span>
                      </div>
                      <div style={{ height: 8, marginTop: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.max(0, percent))}%`, background: "#2563eb" }} /></div>
                      <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>口座: {item.accounts.join(" / ")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {tab === "record" ? (
        <>
          <Section title="最新スナップショット">
            {data.currentSnapshot ? <><div style={{ marginBottom: 14, color: "var(--color-text-muted)", fontSize: 12 }}>基準日 {formatDateTime(data.currentSnapshot.asOf)} / 取込 {formatDateTime(data.currentSnapshot.importedAt)} / {data.currentSnapshot.sourceType}</div><PositionTable positions={data.positions} /></> : <EmptyState>ready状態のスナップショットがありません。</EmptyState>}
          </Section>
          <Section title="取込履歴">
            {data.snapshots.length === 0 ? <EmptyState>取込履歴がありません。</EmptyState> : <div style={{ display: "grid", gap: 8 }}>{data.snapshots.map((snapshot) => <div key={snapshot.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", padding: "8px 0", fontSize: 13 }}><span>{formatDateTime(snapshot.asOf)} / {snapshot.sourceType}</span><span style={{ color: snapshot.status === "ready" ? "#166534" : "var(--color-text-muted)", fontWeight: 800 }}>{snapshot.status}</span></div>)}</div>}
          </Section>
        </>
      ) : null}

      {tab === "policy" ? (
        <Section title="新規資金の投入方針">
          {!data.review ? <EmptyState>方針レビューはまだありません。全保有銘柄の役割・現状判断・買い増し条件・優先順位をレビューとして保存すると、ここに表示します。</EmptyState> : <div style={{ display: "grid", gap: 14 }}><div><h3 style={{ margin: 0, fontSize: 18 }}>{data.review.title}</h3><div style={{ marginTop: 5, color: "var(--color-text-muted)", fontSize: 12 }}>{formatDateTime(data.review.asOf)} / {data.review.status === "finalized" ? "確定" : "下書き"}</div></div>{data.review.newCapitalAmount !== null ? <div style={{ fontWeight: 800 }}>想定新規資金: {formatYen(data.review.newCapitalAmount)}</div> : null}{data.review.summary ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--color-text-sub)" }}>{data.review.summary}</div> : null}{data.review.allocationPolicy ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--color-text-sub)" }}><strong>全体方針</strong><br />{data.review.allocationPolicy}</div> : null}{data.review.items.length === 0 ? <EmptyState>銘柄別の方針項目はまだありません。</EmptyState> : <ol style={{ display: "grid", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>{data.review.items.slice().sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999)).map((item) => <PolicyItem key={item.id} item={item} />)}</ol>}</div>}
        </Section>
      ) : null}

      {tab === "db" ? <DbCheckView data={data} /> : null}
    </div>
  );
}
