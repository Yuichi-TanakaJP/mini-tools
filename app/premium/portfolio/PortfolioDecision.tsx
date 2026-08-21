"use client";

import type { PortfolioData, PortfolioRecommendation, PortfolioAction } from "./types";

const themeLabels: Record<string, string> = {
  income_reinforcement: "インカム源の補強",
  growth_appreciation: "成長・値上がり領域",
  classification_gap: "分類不足の解消",
};

const recommendationLabels: Record<PortfolioRecommendation["recommendationType"], string> = {
  reinforce: "補強",
  new_position: "新規建て",
  maintain: "維持",
  wait: "待機",
  reduce: "縮小検討",
  research: "調査",
};

const actionLabels: Record<PortfolioAction["actionType"], string> = {
  review: "再レビュー",
  allocation_wait: "配分待機",
  staged_investment: "段階投資",
  price_check: "価格確認",
  yield_check: "利回り確認",
  earnings_check: "決算確認",
  concentration_check: "集中確認",
  other: "その他",
};

const priorityLabels = { high: "高", medium: "中", low: "低" } as const;

function formatYen(value: number | null) {
  if (value === null) return "未指定";
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
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
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(date);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.7 }}>{children}</p>;
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "blue" | "green" | "orange" | "red" | "slate" }) {
  const colors = {
    blue: { background: "#eff6ff", color: "#1d4ed8" },
    green: { background: "#dcfce7", color: "#166534" },
    orange: { background: "#fff7ed", color: "#c2410c" },
    red: { background: "#fee2e2", color: "#991b1b" },
    slate: { background: "#f1f5f9", color: "#475569" },
  }[tone];
  return <span style={{ borderRadius: 999, padding: "4px 9px", background: colors.background, color: colors.color, fontSize: 11, fontWeight: 900 }}>{children}</span>;
}

function statusFor(data: PortfolioData) {
  if (data.authState === "required") return { label: "認証が必要", tone: "red" as const, detail: "Supabaseログイン後に保存済み判断を表示します。" };
  if (!data.review) return { label: "最初の棚卸しが必要", tone: "orange" as const, detail: "ChatGPTで全体方針を相談し、reviewを保存してください。" };
  if (!data.currentSnapshot) return { label: "ready snapshotなし", tone: "orange" as const, detail: "保有状況の基準日を確認できるsnapshotがありません。" };
  if (new Date(data.currentSnapshot.asOf).getTime() > new Date(data.review.asOf).getTime()) {
    return { label: "要再レビュー", tone: "orange" as const, detail: "保有snapshotがreviewより新しいため、判断を更新してください。" };
  }
  if (data.review.status === "draft") return { label: "下書きあり", tone: "blue" as const, detail: "保存済みの判断は下書きです。finalizeはChatGPTで明示確認後に行います。" };
  return { label: "判断記録あり", tone: "green" as const, detail: "最新snapshotに対応する保存済み判断があります。" };
}

export function getPortfolioDecisionState(data: PortfolioData) {
  const status = statusFor(data);
  return {
    label: status.label,
    recommendationCount: data.recommendations.length,
    openActionCount: data.actions.filter((action) => action.status === "open").length,
    isAmountless: data.recommendations.length > 0 && data.recommendations.every((recommendation) => recommendation.proposedAmount === null && recommendation.proposedPct === null),
  };
}

function recommendationTarget(recommendation: PortfolioRecommendation) {
  if (recommendation.targetType === "theme") return themeLabels[recommendation.themeKey ?? ""] ?? recommendation.themeKey ?? "テーマ";
  if (recommendation.targetType === "cash") return "待機資金";
  if (recommendation.instrumentIdentifier) return `${recommendation.instrumentIdentifier} ${recommendation.instrumentName ?? ""}`.trim();
  if (recommendation.stockId) return `銘柄候補 (${recommendation.stockId.slice(0, 8)}…)`;
  return "対象未指定";
}

function RecommendationCard({ recommendation }: { recommendation: PortfolioRecommendation }) {
  const targetLabel = recommendationTarget(recommendation);
  return (
    <article style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        {recommendation.priorityRank ? <strong style={{ color: "var(--color-accent)" }}>#{recommendation.priorityRank}</strong> : null}
        <strong>{targetLabel}</strong>
        <Badge tone={recommendation.recommendationType === "research" ? "blue" : "green"}>{recommendationLabels[recommendation.recommendationType]}</Badge>
        {recommendation.priorityTier ? <Badge tone="slate">優先度 {priorityLabels[recommendation.priorityTier]}</Badge> : null}
      </div>
      <div style={{ color: "var(--color-text-sub)", fontSize: 13 }}>
        金額: {formatYen(recommendation.proposedAmount)}
        {recommendation.proposedPct !== null ? ` / 比率: ${recommendation.proposedPct}%` : " / 比率: 未指定"}
      </div>
      {recommendation.conditions.length > 0 ? (
        <div style={{ display: "grid", gap: 4, color: "var(--color-text-sub)", fontSize: 13 }}>
          <strong style={{ fontSize: 12 }}>確認条件</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{recommendation.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        </div>
      ) : null}
      {recommendation.rationale ? <div style={{ color: "var(--color-text-sub)", fontSize: 13, lineHeight: 1.65 }}>理由: {recommendation.rationale}</div> : null}
    </article>
  );
}

function ActionCard({ action }: { action: PortfolioAction }) {
  const statusTone = action.status === "open" ? "orange" : action.status === "done" ? "green" : "slate";
  return (
    <article style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong>{action.title}</strong>
        <Badge tone="blue">{actionLabels[action.actionType]}</Badge>
        <Badge tone={statusTone}>{action.status === "open" ? "未完了" : action.status === "done" ? "完了" : "見送り"}</Badge>
      </div>
      {action.instrumentIdentifier ? <div style={{ color: "var(--color-text-sub)", fontSize: 13 }}>対象: {action.instrumentIdentifier} {action.instrumentName}</div> : null}
      {action.detail ? <div style={{ color: "var(--color-text-sub)", fontSize: 13, lineHeight: 1.65 }}>{action.detail}</div> : null}
      {action.triggerCondition ? <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>実行条件: {action.triggerCondition}</div> : null}
      <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>期限: {formatDate(action.dueDate)} / 登録: {formatDateTime(action.createdAt)}</div>
    </article>
  );
}

function PolicyCard({ data }: { data: PortfolioData }) {
  const policy = data.activePolicy;
  if (!policy) {
    return (
      <Card title="現在の投資方針">
        <EmptyMessage>activeな投資方針はまだありません。ChatGPTで方針案を相談し、確認後にactive化してください。reviewの一時メモとは別に管理されます。</EmptyMessage>
      </Card>
    );
  }

  return (
    <Card title="現在の投資方針">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong>{policy.title}</strong>
          <Badge tone="green">v{policy.versionNumber} / active</Badge>
          <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>適用開始 {formatDate(policy.effectiveFrom)}</span>
        </div>
        {policy.objective ? <div style={{ color: "var(--color-text-sub)", lineHeight: 1.65 }}>{policy.objective}</div> : null}
        {policy.principles.length > 0 ? (
          <div style={{ display: "grid", gap: 5, color: "var(--color-text-sub)", fontSize: 13 }}>
            <strong>原則</strong>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{policy.principles.map((principle) => <li key={principle}>{principle}</li>)}</ul>
          </div>
        ) : null}
        {policy.rules.length > 0 ? (
          <div style={{ display: "grid", gap: 5, color: "var(--color-text-sub)", fontSize: 13 }}>
            <strong>構造化ルール</strong>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{policy.rules.map((rule) => <li key={rule.id}>{rule.dimension} / {rule.targetKey}: {rule.minPct !== null ? `${rule.minPct}%` : "下限なし"}〜{rule.maxPct !== null ? `${rule.maxPct}%` : "上限なし"}{rule.rationale ? `（${rule.rationale}）` : ""}</li>)}</ul>
          </div>
        ) : null}
        <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>この方針はreviewの要約とは別の正本です。変更時は新しい版として履歴に残ります。</div>
      </div>
    </Card>
  );
}

function ReflectionCard({ data }: { data: PortfolioData }) {
  const reflection = data.latestReflection;
  if (!reflection) {
    return (
      <Card title="最新の振り返り">
        <EmptyMessage>振り返りはまだありません。確定済みreviewをもとに、後日GPTで期待と結果を比較して保存します。</EmptyMessage>
      </Card>
    );
  }

  return (
    <Card title="最新の振り返り">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong>{formatDate(reflection.asOf)}</strong>
          {reflection.policyChangeRecommended ? <Badge tone="orange">方針変更案あり</Badge> : <Badge tone="slate">方針継続</Badge>}
        </div>
        {reflection.expectedOutcome ? <div style={{ color: "var(--color-text-sub)", lineHeight: 1.65 }}><strong>期待</strong><br />{reflection.expectedOutcome}</div> : null}
        {reflection.actualOutcome ? <div style={{ color: "var(--color-text-sub)", lineHeight: 1.65 }}><strong>結果</strong><br />{reflection.actualOutcome}</div> : null}
        {reflection.lessons.length > 0 ? <div style={{ color: "var(--color-text-sub)", lineHeight: 1.65 }}><strong>学び</strong><br />{reflection.lessons.join(" / ")}</div> : null}
        {reflection.policyChangeSummary ? <div style={{ color: "var(--color-text-sub)", lineHeight: 1.65 }}><strong>方針変更案</strong><br />{reflection.policyChangeSummary}</div> : null}
      </div>
    </Card>
  );
}

export default function PortfolioDecision({ data }: { data: PortfolioData }) {
  const status = statusFor(data);
  const uniqueInstrumentCount = new Set(data.positions.map((position) => position.identifier)).size;
  const openActions = data.actions.filter((action) => action.status === "open");
  const amountlessRecommendations = data.recommendations.filter((recommendation) => recommendation.proposedAmount === null && recommendation.proposedPct === null);
  const capitalRecommendations = data.recommendations.filter((recommendation) => recommendation.proposedAmount !== null || recommendation.proposedPct !== null);
  const allAmountless = data.recommendations.length > 0 && capitalRecommendations.length === 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="今の判断状態">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span style={{ color: "var(--color-text-sub)", fontSize: 13 }}>{status.detail}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}><div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>保有商品</div><strong style={{ display: "block", marginTop: 6, fontSize: 22 }}>{uniqueInstrumentCount}商品</strong><span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>position {data.positions.length}件</span></div>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}><div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>表示対象の推薦</div><strong style={{ display: "block", marginTop: 6, fontSize: 22 }}>{amountlessRecommendations.length}件</strong><span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{capitalRecommendations.length > 0 ? `金額付き ${capitalRecommendations.length}件は対象外` : "金額を仮定しない"}</span></div>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}><div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>未完了Action</div><strong style={{ display: "block", marginTop: 6, fontSize: 22 }}>{openActions.length}件</strong><span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>次に確認する作業</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, color: "var(--color-text-sub)", fontSize: 13 }}>
            <div><strong>保有基準日</strong><br />{formatDateTime(data.currentSnapshot?.asOf)}</div>
            <div><strong>review基準日</strong><br />{formatDateTime(data.review?.asOf)}</div>
            <div><strong>review状態</strong><br />{data.review?.status === "finalized" ? "確定" : data.review ? "下書き" : "未作成"}</div>
          </div>
        </div>
      </Card>

      <PolicyCard data={data} />

      <ReflectionCard data={data} />

      <Card title="今回の全体判断">
        {!data.review ? <EmptyMessage>まだreviewが保存されていません。MiniToolsから手入力せず、ポートフォリオGPTで相談して保存してください。</EmptyMessage> : (
          <div style={{ display: "grid", gap: 12 }}>
            <div><strong>{data.review.title}</strong><div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 12 }}>保存更新: {formatDateTime(data.review.updatedAt)}</div></div>
            {data.review.summary ? <div style={{ whiteSpace: "pre-wrap", color: "var(--color-text-sub)", lineHeight: 1.75 }}>{data.review.summary}</div> : <EmptyMessage>全体判断の要約は未登録です。</EmptyMessage>}
            {data.review.allocationPolicy ? <div style={{ borderLeft: "3px solid #93c5fd", paddingLeft: 12, whiteSpace: "pre-wrap", color: "var(--color-text-sub)", lineHeight: 1.7 }}><strong>運用方針</strong><br />{data.review.allocationPolicy}</div> : null}
            {data.review.newCapitalAmount === null ? <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>新規資金額は未設定です。この画面は仮の資金額や配分率を作成しません。</div> : <div style={{ fontWeight: 800 }}>想定新規資金: {formatYen(data.review.newCapitalAmount)}</div>}
          </div>
        )}
      </Card>

      <Card title="補強・調査の優先順位">
        {capitalRecommendations.length > 0 ? <div style={{ marginBottom: amountlessRecommendations.length > 0 ? 10 : 0, padding: 12, borderRadius: 10, background: "#fff7ed", color: "#9a3412", fontSize: 13, lineHeight: 1.65 }}>金額または比率付きrecommendation {capitalRecommendations.length}件は、この初回表示の対象外です。金額配分UIを実装するまで、MiniTools上では配分指示として表示しません。</div> : null}
        {amountlessRecommendations.length === 0 ? <EmptyMessage>表示対象のrecommendationはありません。ChatGPTで金額を仮定しない「不足」「補強」「調査」を整理し、確認後に保存するとここへ反映されます。</EmptyMessage> : (
          <div style={{ display: "grid", gap: 10 }}>
            {allAmountless ? <div style={{ padding: 12, borderRadius: 10, background: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.65 }}>現在の推薦はすべて金額なしのテーマ・調査です。銘柄の売買指示や資金配分ではなく、次に検討する論点を保存しています。</div> : null}
            {amountlessRecommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} />)}
          </div>
        )}
      </Card>

      <Card title="次に確認するAction">
        {openActions.length === 0 ? <EmptyMessage>未完了のActionはありません。</EmptyMessage> : <div style={{ display: "grid", gap: 10 }}>{openActions.map((action) => <ActionCard key={action.id} action={action} />)}</div>}
      </Card>
    </div>
  );
}
