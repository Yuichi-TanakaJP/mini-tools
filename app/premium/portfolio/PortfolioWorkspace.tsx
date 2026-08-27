"use client";

import { useMemo, useState } from "react";
import type { PortfolioData, PortfolioDbPosition, PortfolioExternalAssetPosition, PortfolioReviewHistoryItem, PortfolioReviewItem, PortfolioPosition } from "./types";
import { aggregatePortfolioPositions } from "./aggregates";
import { summarizePortfolioDbResult } from "./db-check";
import { isUnresolvedExternalInstrument } from "./external-assets";
import PortfolioDecision from "./PortfolioDecision";

type Tab = "decision" | "overview" | "record" | "policy" | "history" | "db";

const tabLabels: Record<Tab, string> = {
  decision: "意思決定",
  overview: "保有一覧",
  record: "口座・取込",
  policy: "方針",
  history: "履歴",
  db: "DB確認",
};

const accountLabels: Record<string, string> = {
  taxable: "課税口座",
  nisa_growth: "NISA成長投資枠",
  nisa_accumulation: "NISAつみたて投資枠",
  legacy_nisa: "旧つみたてNISA",
  pension: "年金",
  ideco: "iDeCo",
  corporate_dc: "企業型DC",
  foreign_brokerage: "海外証券口座",
  crypto_exchange: "暗号資産取引所",
  bank_cash: "銀行・現金",
  real_estate_crowdfunding: "不動産クラウドファンディング",
  other: "その他",
};

const assetTypeLabels: Record<string, string> = {
  domestic_stock: "国内株",
  foreign_stock: "海外株",
  investment_fund: "投資信託",
  equity_fund: "株式ファンド",
  bond: "債券",
  bond_fund: "債券ファンド",
  fixed_deposit: "定期預金",
  cash: "現金",
  cash_equivalent: "現金同等物",
  mmf: "MMF",
  reit: "REIT",
  crypto: "暗号資産",
  real_estate_crowdfunding: "不動産クラウドファンディング",
  other: "その他",
};

const withdrawalLabels: Record<string, string> = {
  immediate: "引出制限なし",
  restricted: "引出制限あり",
  retirement_locked: "退職まで引出不可",
  temporarily_locked: "一時引出不可",
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

function formatNativeValue(value: number | null, currency: string | null) {
  if (value === null) return "—";
  if (!currency || currency === "JPY") return formatYen(value);
  try {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${formatNumber(value, 2)} ${currency}`;
  }
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

function snapshotHistory(data: PortfolioData) {
  return [...data.snapshots, ...data.externalSnapshots].sort((a, b) => b.asOf.localeCompare(a.asOf) || b.importedAt.localeCompare(a.importedAt) || b.id.localeCompare(a.id));
}

function externalAssetStatusLabel(status: "loaded" | "empty" | "loading" | "error") {
  if (status === "loaded") return "登録済み";
  if (status === "loading") return "取込中";
  if (status === "error") return "取得失敗";
  return "未登録";
}

function externalAssetSummary(status: "loaded" | "empty" | "loading" | "error") {
  if (status === "loaded") return " / 外部参照あり";
  if (status === "loading") return " / 外部資産取込中";
  if (status === "error") return " / 外部資産取得失敗";
  return "";
}

function externalAssetEmptyMessage(status: "loaded" | "empty" | "loading" | "error") {
  if (status === "loaded") return "外部参照資産は下の「口座・取込」で確認できます。公式保有の評価額・構成比は、公式snapshotが登録されるまで表示しません。";
  if (status === "loading") return "外部資産は現在取込中です。取込が完了してreadyになるまで、公式保有へ合算しません。詳細は下の「口座・取込」で確認できます。";
  if (status === "error") return "外部資産の最新取込に失敗しています。公式保有の表示とは分けて、詳細は下の「口座・取込」で確認できます。";
  return "証券会社CSVをstock-notesの取込APIへ送ると、ここに最新スナップショットが表示されます。既存のmy-stocksデータはこの画面へ自動コピーせず、取込履歴を正本として管理します。";
}

function ExternalAssetStatus({ status }: { status: "loaded" | "empty" | "loading" | "error" }) {
  const colors = {
    loaded: { background: "#dcfce7", color: "#166534" },
    empty: { background: "#fef3c7", color: "#92400e" },
    loading: { background: "#dbeafe", color: "#1d4ed8" },
    error: { background: "#fee2e2", color: "#991b1b" },
  }[status];
  return <span style={{ borderRadius: 999, padding: "4px 9px", background: colors.background, color: colors.color, fontSize: 12, fontWeight: 900 }}>{externalAssetStatusLabel(status)}</span>;
}

function ExternalAssetPositionTable({ positions }: { positions: PortfolioExternalAssetPosition[] }) {
  if (positions.length === 0) return <EmptyState>外部snapshotにポジション明細がありません。</EmptyState>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 1060, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--color-text-muted)", fontSize: 11 }}>
            {["資産", "口座", "数量・残高", "取得元通貨", "円評価額", "確認状態"].map((label) => (
              <th key={label} style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const missingValue = position.marketValue === null;
            const unresolved = isUnresolvedExternalInstrument(position);
            return (
              <tr key={position.id}>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ fontWeight: 900 }}>{position.identifier ?? "識別子未登録"}</div>
                  <div style={{ marginTop: 3, color: "var(--color-text-sub)" }}>{position.name ?? position.instrumentId}</div>
                  <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{assetTypeLabels[position.assetType ?? ""] ?? position.assetType ?? "資産種別未登録"}</div>
                </td>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                  <div>{position.accountName ?? position.accountId}</div>
                  <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{accountLabels[position.accountType ?? ""] ?? position.accountType ?? "口座種別未登録"}</div>
                  {position.withdrawalProfile ? <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{withdrawalLabels[position.withdrawalProfile] ?? position.withdrawalProfile}</div> : null}
                </td>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                  <div>{position.valuationMode === "balance" ? "残高" : "数量"}: {position.valuationMode === "balance" ? formatNativeValue(position.nativeMarketValue ?? position.marketValue, position.nativeCurrency) : formatNumber(position.quantity, 4)}</div>
                  <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{position.valuationMode === "balance" ? "残高方式" : "数量方式"}</div>
                </td>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)" }}>
                  <div>{formatNativeValue(position.nativeMarketValue, position.nativeCurrency)}</div>
                  {position.fxRate !== null ? <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>換算 {formatNumber(position.fxRate, 4)}</div> : null}
                </td>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)", fontWeight: 800 }}>{formatYen(position.marketValue)}</td>
                <td style={{ padding: "11px 7px", borderBottom: "1px solid var(--color-border)", color: missingValue || unresolved ? "#92400e" : "#166534", fontWeight: 800 }}>
                  {missingValue ? "評価額未取得" : unresolved ? "銘柄未紐付け" : "表示可能"}
                  {missingValue && unresolved ? <div style={{ marginTop: 3, fontSize: 11, fontWeight: 500 }}>外部資産として保持</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExternalAssetsView({ data }: { data: PortfolioData }) {
  const externalAssets = data.externalAssets;
  const hasReadySnapshot = externalAssets.snapshot?.status === "ready";
  return (
    <Section title="外部口座・参考資産">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ExternalAssetStatus status={externalAssets.status} />
          <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>iDeCo・企業型DC・海外口座・暗号資産・現金等。ChatGPT/APIで保存した外部参照snapshotを表示しています。</span>
        </div>
        {externalAssets.status === "empty" ? <EmptyState>外部資産はまだ登録されていません。ChatGPTで内容を確認してから、外部資産保存APIで登録するとここに表示されます。</EmptyState> : null}
        {externalAssets.status === "loading" && !hasReadySnapshot ? <EmptyState>外部資産の取込処理中です。処理が完了してreadyになるまで、明細は公式保有へ合算しません。</EmptyState> : null}
        {externalAssets.status === "error" && !hasReadySnapshot ? (
          <div style={{ borderRadius: 10, background: "#fef2f2", color: "#991b1b", padding: 12, lineHeight: 1.7 }}>
            {externalAssets.errorMessage ?? "外部資産データを取得できませんでした。"} 公式snapshotの表示・集計には影響していません。
          </div>
        ) : null}
        {hasReadySnapshot ? (
          <>
            {externalAssets.errorMessage ? <div style={{ borderRadius: 10, background: externalAssets.status === "error" ? "#fef2f2" : "#fffbeb", color: externalAssets.status === "error" ? "#991b1b" : "#92400e", padding: 12, lineHeight: 1.7 }}>{externalAssets.errorMessage} 公式snapshotの表示・集計には影響していません。</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <Metric label="外部資産評価額" value={formatYen(externalAssets.totalMarketValue)} sub={`${externalAssets.positions.length}明細`} />
              <Metric label="基準日" value={formatDate(externalAssets.snapshot.asOf)} sub={externalAssets.snapshot.sourceLabel ?? externalAssets.snapshot.sourceType} />
              <Metric label="未紐付け" value={`${externalAssets.unresolvedInstrumentCount}件`} sub="個別銘柄との関連付け" />
              <Metric label="評価額未取得" value={`${externalAssets.missingMarketValueCount}件`} sub="—は0円ではありません" />
            </div>
            <div style={{ borderRadius: 10, background: "#eff6ff", color: "#1e3a8a", padding: 12, fontSize: 12, lineHeight: 1.7 }}>
              公式snapshotとは別の <code>external_reference</code> として管理しています。現段階では「保有一覧」や意思決定の公式集計へ自動合算していません。二重計上を避けるため、合算ルールは別途決めます。
            </div>
            <ExternalAssetPositionTable positions={externalAssets.positions} />
          </>
        ) : null}
      </div>
    </Section>
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

function reviewStatusLabel(review: PortfolioReviewHistoryItem, currentReviewId: string | null) {
  if (review.status === "draft") return review.id === currentReviewId ? "下書き・現行" : "下書き・旧";
  if (review.status === "finalized") return "確定";
  return "置換済み";
}

function ReviewHistoryView({ data }: { data: PortfolioData }) {
  const policyTitles = new Map(data.policyHistory.map((policy) => [policy.id, `v${policy.versionNumber} ${policy.title}`]));
  const snapshots = snapshotHistory(data);

  return (
    <>
      <Section title="ポートフォリオreview履歴">
        <div style={{ marginBottom: 12, color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.6 }}>
          ChatGPTで保存したreviewの履歴です。<strong>置換済み</strong>は未確定のまま新しいreviewに切り替えた記録で、現在の判断には使いません。
        </div>
        {data.reviewHistory.length === 0 ? <EmptyState>review履歴はありません。</EmptyState> : (
          <div style={{ display: "grid", gap: 9 }}>
            {data.reviewHistory.map((review) => (
              <div key={review.id} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                  <div>
                    <strong>{review.title}</strong>
                    <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 12 }}>基準日 {formatDateTime(review.asOf)} / 更新 {formatDateTime(review.updatedAt)}</div>
                  </div>
                  <span style={{ borderRadius: 999, padding: "4px 9px", background: review.status === "superseded" ? "#f1f5f9" : review.status === "finalized" ? "#dcfce7" : "#dbeafe", color: review.status === "superseded" ? "#475569" : review.status === "finalized" ? "#166534" : "#1d4ed8", fontSize: 11, fontWeight: 900 }}>
                    {reviewStatusLabel(review, data.review?.id ?? null)}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 4, color: "var(--color-text-sub)", fontSize: 12 }}>
                  <div><strong>参照policy:</strong> {review.policyVersionId ? policyTitles.get(review.policyVersionId) ?? review.policyVersionId : "未紐付け（legacy review）"}</div>
                  <div><strong>対象snapshot:</strong> {review.snapshotId ?? "未紐付け"}</div>
                  {review.status === "superseded" && review.supersedeReason ? <div><strong>置換理由:</strong> {review.supersedeReason}</div> : null}
                  {review.newCapitalAmount !== null ? <div><strong>想定新規資金:</strong> {formatYen(review.newCapitalAmount)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="snapshot取込履歴">
        {snapshots.length === 0 ? <EmptyState>取込履歴がありません。</EmptyState> : (
          <div style={{ display: "grid", gap: 8 }}>
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", padding: "8px 0", fontSize: 13 }}>
                <span>{formatDateTime(snapshot.asOf)} / {snapshot.portfolioScope === "external_reference" ? "外部参照" : "公式"} / {snapshot.sourceType}</span>
                <span style={{ color: snapshot.status === "ready" ? "#166534" : "var(--color-text-muted)", fontWeight: 800 }}>{snapshot.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function DbPositionTable({ positions }: { positions: PortfolioDbPosition[] }) {
  if (positions.length === 0) return <EmptyState>このreadyスナップショットにはポジション行がありません。</EmptyState>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--color-text-muted)", fontSize: 11 }}>
            {['position ID', '商品', '口座', '数量', '評価額', '状態'].map((label) => (
              <th key={label} style={{ padding: "8px 7px", borderBottom: "1px solid var(--color-border)" }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const resolved = Boolean(position.assetType && position.identifier && position.name && position.accountName && position.accountType && position.institutionName);
            return (
              <tr key={position.id}>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all" }}>{position.id}</td>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)" }}>
                  <div>{position.identifier ?? "未解決"}</div>
                  <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 11 }}>{position.name ?? position.instrumentId}</div>
                </td>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)" }}>{position.accountName ?? position.accountId}</td>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatNumber(position.quantity, 2)}</td>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)" }}>{formatYen(position.marketValue)}</td>
                <td style={{ padding: "10px 7px", borderBottom: "1px solid var(--color-border)", color: resolved ? "#166534" : "#991b1b", fontWeight: 800 }}>{resolved ? "関連解決済み" : "関連行なし"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DbValue({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <span style={{ color: muted ? "var(--color-text-muted)" : "var(--color-text-sub)", wordBreak: "break-word" }}>{children}</span>;
}

function DbStatus({ state }: { state: "auth_required" | "empty" | "no_ready_snapshot" | "loaded" }) {
  const label = state === "loaded" ? "読み込み済み" : state === "empty" ? "未取込" : state === "no_ready_snapshot" ? "ready snapshotなし" : "認証が必要";
  const colors = {
    loaded: { background: "#dcfce7", color: "#166534" },
    empty: { background: "#fef3c7", color: "#92400e" },
    no_ready_snapshot: { background: "#fef3c7", color: "#92400e" },
    auth_required: { background: "#fee2e2", color: "#991b1b" },
  }[state];
  return <span style={{ borderRadius: 999, padding: "4px 9px", background: colors.background, color: colors.color, fontSize: 12, fontWeight: 900 }}>{label}</span>;
}

function DbCheckView({ data }: { data: PortfolioData }) {
  const summary = useMemo(() => summarizePortfolioDbResult(data), [data]);
  const rows = [
    ["portfolio", summary.portfolioId ? 1 : 0, summary.portfolioName ?? "未作成"],
    ["portfolio_snapshots", summary.snapshotCount, summary.currentSnapshotId ? `current: ${summary.currentSnapshotId}` : "ready snapshotなし"],
    ["portfolio_positions", summary.positionCount, `${summary.instrumentCount}商品（ユーザー単位） / ${summary.accountCount}口座`],
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
            <Metric label="position" value={`${summary.positionCount}件`} sub={`${summary.instrumentCount}商品（ユーザー単位）`} />
            <Metric label="review item" value={`${summary.reviewItemCount}件`} sub={summary.reviewStatus === "finalized" ? "確定review" : summary.reviewStatus === "draft" ? "下書きreview" : "reviewなし"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, fontSize: 13 }}>
            <div><strong>portfolio ID</strong><br /><DbValue muted={!summary.portfolioId}>{summary.portfolioId ?? "—"}</DbValue></div>
            <div><strong>ready snapshot ID</strong><br /><DbValue muted={!summary.currentSnapshotId}>{summary.currentSnapshotId ?? "—"}</DbValue></div>
            <div><strong>最新取込 snapshot ID</strong><br /><DbValue muted={!summary.latestSnapshotId}>{summary.latestSnapshotId ?? "—"}</DbValue></div>
            <div><strong>review ID</strong><br /><DbValue muted={!summary.reviewId}>{summary.reviewId ?? "—"}</DbValue></div>
            <div><strong>ready基準日</strong><br /><DbValue muted={!summary.currentSnapshotAsOf}>{formatDateTime(summary.currentSnapshotAsOf)}</DbValue></div>
            <div><strong>最新取込日時・status</strong><br /><DbValue muted={!summary.latestSnapshotAsOf}>{summary.latestSnapshotAsOf ? `${formatDateTime(summary.latestSnapshotAsOf)} / ${summary.latestSnapshotStatus}` : "—"}</DbValue></div>
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
        {data.dbPositionSnapshot ? <><div style={{ marginBottom: 12, color: "var(--color-text-muted)", fontSize: 12 }}>対象snapshot: {data.dbPositionSnapshot.id} / 基準日 {formatDateTime(data.dbPositionSnapshot.asOf)} / status {data.dbPositionSnapshot.status}</div><DbPositionTable positions={data.dbPositions} /></> : <EmptyState>取込snapshotがないため、ポジション明細は表示していません。</EmptyState>}
      </Section>
    </>
  );
}

export default function PortfolioWorkspace({ data }: { data: PortfolioData }) {
  const [tab, setTab] = useState<Tab>("decision");
  const grouped = useMemo(() => aggregatePortfolioPositions(data.positions), [data.positions]);
  const totalValue = sumNullable(data.positions.map((position) => position.marketValue));
  const totalCost = sumNullable(data.positions.map((position) => position.costBasis));
  const totalPnl = sumNullable(data.positions.map((position) => position.unrealizedPnl));
  const pnlRate = totalCost && totalPnl !== null ? (totalPnl / totalCost) * 100 : null;
  const hasSnapshotHistory = data.snapshots.some((snapshot) => snapshot.portfolioScope === "official");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "#102033", color: "#fff", borderRadius: 12, padding: "22px 20px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800 }}>Portfolio</div>
            <h1 style={{ margin: "7px 0 0", fontSize: 30 }}>ポートフォリオ</h1>
          </div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, textAlign: "right" }}>
            <div>{data.authState === "required" ? "Supabase認証待ち" : data.portfolio.name ?? "ポートフォリオ未作成"}</div>
            <div style={{ marginTop: 4 }}>{data.authState === "required" ? "認証が必要" : data.currentSnapshot ? `基準日 ${formatDate(data.currentSnapshot.asOf)}` : hasSnapshotHistory ? `公式ready snapshotなし${externalAssetSummary(data.externalAssets.status)}` : data.externalAssets.status === "empty" ? "CSV未取込" : `公式snapshotなし${externalAssetSummary(data.externalAssets.status)}`}</div>
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

      {data.authState === "required" ? (
        <Section title="Supabaseログインが必要です">
          <EmptyState>このポートフォリオはSupabaseのログインユーザー単位で表示します。先に <a href="/account">アカウント</a> へログインしてください。DB確認タブでは認証状態を確認できます。</EmptyState>
        </Section>
      ) : data.source === "empty" ? (
        <Section title={hasSnapshotHistory ? `公式readyスナップショットがありません${externalAssetSummary(data.externalAssets.status)}` : data.externalAssets.status === "empty" ? "ポートフォリオデータはまだありません" : `公式snapshotがありません${externalAssetSummary(data.externalAssets.status)}`}>
          <EmptyState>{hasSnapshotHistory ? `公式の取込履歴はありますが、ready状態のスナップショットがありません。${data.externalAssets.status === "empty" ? "" : externalAssetEmptyMessage(data.externalAssets.status)} DB確認タブで取込結果とreviewの保存状況を確認できます。` : externalAssetEmptyMessage(data.externalAssets.status)}</EmptyState>
          {data.externalAssets.status !== "empty" ? <ExternalAssetsView data={data} /> : null}
        </Section>
      ) : null}

      {data.authState === "required" ? (
        tab === "db" ? <DbCheckView data={data} /> : null
      ) : (
        <>
      {tab === "decision" ? <PortfolioDecision data={data} /> : null}

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
                    <div key={item.instrumentId}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                        <span><strong>{item.identifier}</strong> {item.name}</span>
                        <span style={{ fontWeight: 800 }}>{formatYen(item.marketValue)} / {formatNumber(percent, 1)}%</span>
                      </div>
                      <div style={{ height: 8, marginTop: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.max(0, percent))}%`, background: "#2563eb" }} /></div>
                      <div style={{ marginTop: 4, color: "var(--color-text-sub)", fontSize: 11 }}>数量: {formatNumber(item.quantity, 2)} / 取得額: {formatYen(item.costBasis)} / 損益: {formatYen(item.unrealizedPnl)}</div>
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
            {snapshotHistory(data).length === 0 ? <EmptyState>取込履歴がありません。</EmptyState> : <div style={{ display: "grid", gap: 8 }}>{snapshotHistory(data).map((snapshot) => <div key={snapshot.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", padding: "8px 0", fontSize: 13 }}><span>{formatDateTime(snapshot.asOf)} / {snapshot.portfolioScope === "external_reference" ? "外部参照" : "公式"} / {snapshot.sourceType}</span><span style={{ color: snapshot.status === "ready" ? "#166534" : "var(--color-text-muted)", fontWeight: 800 }}>{snapshot.status}</span></div>)}</div>}
          </Section>
          {data.source !== "empty" ? <ExternalAssetsView data={data} /> : null}
        </>
      ) : null}

      {tab === "history" ? <ReviewHistoryView data={data} /> : null}

      {tab === "policy" ? (
        <>
          <Section title="投資方針の現在版">
            {!data.activePolicy ? <EmptyState>activeな投資方針はまだありません。ChatGPTで方針案を相談し、確認後にactive化してください。</EmptyState> : <div style={{ display: "grid", gap: 12 }}><div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><h3 style={{ margin: 0, fontSize: 18 }}>{data.activePolicy.title}</h3><span style={{ borderRadius: 999, background: "#dcfce7", color: "#166534", padding: "4px 9px", fontSize: 11, fontWeight: 900 }}>v{data.activePolicy.versionNumber} / active</span><span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>適用開始 {formatDateTime(data.activePolicy.effectiveFrom)}</span></div>{data.activePolicy.objective ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--color-text-sub)" }}>{data.activePolicy.objective}</div> : null}{data.activePolicy.principles.length > 0 ? <div style={{ color: "var(--color-text-sub)", fontSize: 13 }}><strong>原則</strong><ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{data.activePolicy.principles.map((principle) => <li key={principle}>{principle}</li>)}</ul></div> : null}{data.activePolicy.rules.length > 0 ? <div style={{ color: "var(--color-text-sub)", fontSize: 13 }}><strong>構造化ルール</strong><ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{data.activePolicy.rules.map((rule) => <li key={rule.id}>{rule.dimension} / {rule.targetKey}: {rule.minPct !== null ? `${rule.minPct}%` : "下限なし"}〜{rule.maxPct !== null ? `${rule.maxPct}%` : "上限なし"}</li>)}</ul></div> : null}<div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>reviewに書かれた一時的な判断ではなく、現在の正本方針を表示しています。</div></div>}
          </Section>
          <Section title="方針の変更履歴">
            {data.policyHistory.length === 0 ? <EmptyState>方針履歴はありません。</EmptyState> : <div style={{ display: "grid", gap: 8 }}>{data.policyHistory.map((policy) => <div key={policy.id} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><strong>v{policy.versionNumber} {policy.title}</strong><div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 12 }}>{formatDateTime(policy.effectiveFrom ?? policy.createdAt)} / {policy.changeReason ?? "変更理由未登録"}</div></div><span style={{ color: policy.status === "active" ? "#166534" : "var(--color-text-muted)", fontWeight: 800, fontSize: 12 }}>{policy.status === "active" ? "active" : policy.status === "superseded" ? "旧版" : "draft"}</span></div>)}</div>}
          </Section>
          <Section title="最新reviewの一時判断">
            {!data.review ? <EmptyState>{data.reviewHistory.some((review) => review.status === "superseded") ? "現行reviewはありません。旧reviewは履歴タブで置換済みとして確認できます。ChatGPTで新しいreviewを作成してください。" : "reviewはまだありません。"}</EmptyState> : <div style={{ display: "grid", gap: 14 }}><div><h3 style={{ margin: 0, fontSize: 18 }}>{data.review.title}</h3><div style={{ marginTop: 5, color: "var(--color-text-muted)", fontSize: 12 }}>{formatDateTime(data.review.asOf)} / {data.review.status === "finalized" ? "確定" : "下書き"}</div></div>{data.review.newCapitalAmount !== null ? <div style={{ fontWeight: 800 }}>想定新規資金: {formatYen(data.review.newCapitalAmount)}</div> : null}{data.review.summary ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--color-text-sub)" }}>{data.review.summary}</div> : null}{data.review.allocationPolicy ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--color-text-sub)" }}><strong>今回の判断メモ</strong><br />{data.review.allocationPolicy}</div> : null}{data.review.items.length === 0 ? <EmptyState>銘柄別の方針項目はまだありません。</EmptyState> : <ol style={{ display: "grid", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>{data.review.items.slice().sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999)).map((item) => <PolicyItem key={item.id} item={item} />)}</ol>}</div>}
          </Section>
          <Section title="最新の振り返り">
            {!data.latestReflection ? <EmptyState>振り返りはまだありません。</EmptyState> : <div style={{ display: "grid", gap: 8, color: "var(--color-text-sub)", lineHeight: 1.7 }}><div><strong>{formatDateTime(data.latestReflection.asOf)}</strong>{data.latestReflection.policyChangeRecommended ? <span style={{ marginLeft: 8, color: "#c2410c", fontWeight: 800 }}>方針変更案あり</span> : null}</div>{data.latestReflection.expectedOutcome ? <div><strong>期待:</strong> {data.latestReflection.expectedOutcome}</div> : null}{data.latestReflection.actualOutcome ? <div><strong>結果:</strong> {data.latestReflection.actualOutcome}</div> : null}{data.latestReflection.lessons.length > 0 ? <div><strong>学び:</strong> {data.latestReflection.lessons.join(" / ")}</div> : null}{data.latestReflection.policyChangeSummary ? <div><strong>方針変更案:</strong> {data.latestReflection.policyChangeSummary}</div> : null}</div>}
          </Section>
        </>
      ) : null}

      {tab === "db" ? <DbCheckView data={data} /> : null}
        </>
      )}
    </div>
  );
}
