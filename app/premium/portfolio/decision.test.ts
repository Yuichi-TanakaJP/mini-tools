import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PortfolioDecision from "./PortfolioDecision";
import PortfolioWorkspace from "./PortfolioWorkspace";
import { getPortfolioDecisionState, reviewPolicyReferenceLabel } from "./PortfolioDecision";
import { emptyExternalAssets } from "./external-assets";
import type { PortfolioData } from "./types";

const baseData: PortfolioData = {
  authState: "authenticated",
  portfolio: { id: "portfolio-1", name: "メイン", baseCurrency: "JPY" },
  snapshots: [{ id: "snapshot-1", asOf: "2026-08-14T00:00:00Z", status: "ready", sourceType: "broker_csv", importedAt: "2026-08-14T00:01:00Z", portfolioScope: "official", sourceLabel: null }],
  externalSnapshots: [],
  currentSnapshot: { id: "snapshot-1", asOf: "2026-08-14T00:00:00Z", status: "ready", sourceType: "broker_csv", importedAt: "2026-08-14T00:01:00Z", portfolioScope: "official", sourceLabel: null },
  dbPositionSnapshot: null,
  externalAssets: emptyExternalAssets(),
  positions: [],
  dbPositions: [],
  review: { id: "review-1", policyVersionId: null, title: "レビュー", status: "draft", asOf: "2026-08-14T00:02:00Z", newCapitalAmount: null, summary: null, allocationPolicy: null, updatedAt: "2026-08-14T00:02:00Z", items: [] },
  reviewHistory: [],
  activePolicy: null,
  policyHistory: [],
  latestReflection: null,
  reflections: [],
  recommendations: [{ id: "recommendation-1", reviewId: "review-1", targetType: "theme", instrumentId: null, instrumentIdentifier: null, instrumentName: null, stockId: null, themeKey: "income_reinforcement", recommendationType: "research", priorityTier: "high", priorityRank: 1, proposedAmount: null, proposedPct: null, conditions: [], rationale: null, rejectionReason: null, createdAt: "2026-08-14T00:03:00Z", updatedAt: "2026-08-14T00:03:00Z" }],
  actions: [{ id: "action-1", reviewId: "review-1", instrumentId: null, instrumentIdentifier: null, instrumentName: null, actionType: "review", title: "確認", detail: null, triggerCondition: null, dueDate: null, status: "open", createdAt: "2026-08-14T00:04:00Z", updatedAt: "2026-08-14T00:04:00Z" }],
  dbCounts: { portfolio: 1, snapshots: 1, accounts: 0, instruments: 0, positions: 0, reviews: 1, reviewItems: 0 },
  source: "server",
};

describe("portfolio decision view state", () => {
  it("長い判断と条件を削除せず閉じた詳細に保持する", () => {
    const summary = "保存された判断".repeat(80);
    const data = { ...baseData, review: { ...baseData.review!, summary } };
    const html = renderToStaticMarkup(createElement(PortfolioDecision, { data }));
    expect(html).toContain(summary);
    expect(html).toContain("冒頭抜粋");
    expect(html).toContain("保存済み判断の全文を見る");
    expect(html).toContain("条件・理由を見る");
    expect(html).not.toMatch(/<details[^>]*\bopen/);
  });

  it("初期表示は意思決定が主で企業グループ情報を割り込ませない", () => {
    const html = renderToStaticMarkup(createElement(PortfolioWorkspace, { data: baseData, groupExposure: "GROUP_DETAIL_FIXTURE" }));
    expect(html).toContain("詳細メニュー");
    expect(html).toContain("口座・取込");
    expect(html).toContain("DB確認");
    expect(html).not.toContain("GROUP_DETAIL_FIXTURE");
  });
  it("金額なし推薦と未完了Actionを判断状態として数える", () => {
    expect(getPortfolioDecisionState(baseData)).toMatchObject({
      label: "下書きあり",
      recommendationCount: 1,
      openActionCount: 1,
      isAmountless: true,
    });
  });

  it("reviewがない状態を最初の棚卸しとして表現する", () => {
    expect(getPortfolioDecisionState({ ...baseData, review: null, recommendations: [], actions: [] })).toMatchObject({
      label: "最初の棚卸しが必要",
      recommendationCount: 0,
      openActionCount: 0,
      isAmountless: false,
    });
  });

  it("snapshotがreviewより新しい状態を要再レビューとする", () => {
    expect(getPortfolioDecisionState({
      ...baseData,
      currentSnapshot: { ...baseData.currentSnapshot!, asOf: "2026-08-20T00:00:00Z" },
    }).label).toBe("要再レビュー");
  });

  it("reviewが参照したpolicy versionを表示できる", () => {
    expect(reviewPolicyReferenceLabel({
      ...baseData,
      review: { ...baseData.review!, policyVersionId: "policy-2" },
      policyHistory: [{
        id: "policy-2",
        versionNumber: 2,
        status: "active",
        title: "v2",
        objective: null,
        timeHorizon: null,
        incomePriority: null,
        capitalGrowthPriority: null,
        riskStatement: null,
        cashPolicy: null,
        buyPolicy: null,
        sellPolicy: null,
        principles: [],
        constraints: [],
        changeReason: null,
        basedOnPolicyId: null,
        effectiveFrom: null,
        createdAt: "2026-08-14T00:00:00Z",
        updatedAt: "2026-08-14T00:00:00Z",
        rules: [],
      }],
    })).toBe("v2 / active");
    expect(reviewPolicyReferenceLabel(baseData)).toBe("未紐付け（legacy review）");
  });
});
