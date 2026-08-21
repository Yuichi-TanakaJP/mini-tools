import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPortfolio, portfolioAuthRequired } from "./data";

class QueryStub {
  constructor(private readonly result: unknown, private readonly queryLog: string[] = []) {}

  select() {
    return this;
  }

  eq(column?: string, value?: unknown) {
    if (column === "status" && value === "open") this.queryLog.push("status=open");
    return this;
  }

  in() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.result);
  }

  returns() {
    return Promise.resolve(this.result);
  }
}

function stubClient(results: Record<string, unknown>, queryLog: string[] = []) {
  return {
    from(table: string) {
      return new QueryStub(results[table] ?? { data: [], error: null }, queryLog);
    },
  } as unknown as SupabaseClient;
}

describe("portfolio data loader", () => {
  it("認証必須状態をサンプルデータなしで返す", () => {
    const data = portfolioAuthRequired();

    expect(data.authState).toBe("required");
    expect(data.source).toBe("empty");
    expect(data.positions).toEqual([]);
  });

  it("portfolio未作成なら空状態を返す", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: null, error: null },
      }),
    );

    expect(data.portfolio.id).toBeNull();
    expect(data.currentSnapshot).toBeNull();
    expect(data.source).toBe("empty");
  });

  it("最新スナップショットとreview itemを正規化する", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: {
          data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" },
          error: null,
        },
        stock_notes_portfolio_snapshots: {
          data: [{ id: "snapshot-1", as_of: "2026-08-14T00:00:00Z", status: "ready", source_type: "broker_csv", imported_at: "2026-08-14T00:01:00Z" }],
          error: null,
        },
        stock_notes_portfolio_accounts: {
          data: [{ id: "account-1", account_name: "特定預り", account_type: "taxable", institution_name: "テスト証券" }],
          error: null,
        },
        stock_notes_portfolio_instruments: {
          data: [{ id: "instrument-1", asset_type: "domestic_stock", identifier: "9999", name: "テスト銘柄" }],
          error: null,
        },
        stock_notes_portfolio_positions: {
          data: [
            { id: "position-1", account_id: "account-1", instrument_id: "instrument-1", quantity: "2", unit_cost: "1000", quoted_price: "1200", quote_unit: "1", cost_basis: "2000", market_value: "2400", unrealized_pnl: "400", distribution_method: null },
            { id: "position-2", account_id: "account-missing", instrument_id: "instrument-1", quantity: "1", unit_cost: "900", quoted_price: "1200", quote_unit: "1", cost_basis: "900", market_value: "1200", unrealized_pnl: "300", distribution_method: null },
          ],
          error: null,
        },
        stock_notes_portfolio_reviews: {
          data: { id: "review-1", title: "8月棚卸し", status: "draft", as_of: "2026-08-14T00:02:00Z", new_capital_amount: "100000", summary: "分散を維持", allocation_policy: "押し目を待つ", updated_at: "2026-08-14T00:02:00Z" },
          error: null,
        },
        stock_notes_portfolio_policy_versions: {
          data: [{ id: "policy-2", version_number: 2, status: "active", title: "高配当を軸に成長も重視", objective: "配当と成長を両立", time_horizon: "長期", income_priority: "high", capital_growth_priority: "medium", risk_statement: "分散を維持", cash_policy: null, buy_policy: "押し目で買い増し", sell_policy: null, principles: ["高配当を切り口にする", "成長も評価する"], constraints: [], change_reason: "成長も一定割合重視", based_on_policy_id: "policy-1", effective_from: "2026-08-14T00:00:00Z", created_at: "2026-08-14T00:00:00Z", updated_at: "2026-08-14T00:00:00Z" }],
          error: null,
        },
        stock_notes_portfolio_policy_rules: {
          data: [{ id: "rule-1", policy_version_id: "policy-2", dimension: "cycle_profile", target_key: "cyclical", min_pct: "70", max_pct: "70", priority: "preferred", rationale: "当面の目安" }],
          error: null,
        },
        stock_notes_portfolio_reflections: {
          data: [{ id: "reflection-1", review_id: "review-finalized", as_of: "2026-08-20T00:00:00Z", expected_outcome: "分散を維持", actual_outcome: "集中は許容範囲", worked_well: ["業種分散"], did_not_work: [], missed_risks: ["未分類商品"], lessons: ["分類の鮮度を確認する"], policy_change_recommended: true, policy_change_summary: "分類確認を定期化", created_at: "2026-08-20T00:00:00Z" }],
          error: null,
        },
        stock_notes_portfolio_review_items: {
          data: [{ id: "item-1", instrument_id: "instrument-1", item_status: "reviewed", role_labels: ["高配当"], stance: "hold", portfolio_need: "maintain", priority_tier: "medium", priority_rank: 1, target_allocation_pct: "10", proposed_new_capital_amount: "0", buy_conditions: ["押し目"], rationale: "役割は十分", policy_note: null }],
          error: null,
        },
        stock_notes_portfolio_recommendations: {
          data: [{ id: "recommendation-1", review_id: "review-1", target_type: "theme", instrument_id: null, stock_id: null, theme_key: "income_reinforcement", recommendation_type: "research", priority_tier: "high", priority_rank: 1, proposed_amount: null, proposed_pct: null, conditions: ["利回り確認"], rationale: "調査する", rejection_reason: null, created_at: "2026-08-14T00:03:00Z", updated_at: "2026-08-14T00:03:00Z" }],
          error: null,
        },
        stock_notes_portfolio_actions: {
          data: [{ id: "action-1", review_id: "review-1", instrument_id: null, action_type: "concentration_check", title: "集中確認", detail: "業種集中を確認", trigger_condition: "分類後", due_date: null, status: "open", created_at: "2026-08-14T00:04:00Z", updated_at: "2026-08-14T00:04:00Z" }],
          error: null,
        },
      }),
    );

    expect(data.source).toBe("server");
    expect(data.positions[0]).toMatchObject({ identifier: "9999", quantity: 2, marketValue: 2400 });
    expect(data.positions).toHaveLength(1);
    expect(data.dbPositions).toHaveLength(2);
    expect(data.dbPositions[1]).toMatchObject({ id: "position-2", accountName: null, accountId: "account-missing" });
    expect(data.review?.items[0]).toMatchObject({ stance: "hold", targetAllocationPct: 10, buyConditions: ["押し目"] });
    expect(data.activePolicy).toMatchObject({ versionNumber: 2, status: "active", title: "高配当を軸に成長も重視" });
    expect(data.activePolicy?.rules[0]).toMatchObject({ dimension: "cycle_profile", targetKey: "cyclical", minPct: 70, maxPct: 70 });
    expect(data.latestReflection).toMatchObject({ policyChangeRecommended: true, lessons: ["分類の鮮度を確認する"] });
    expect(data.recommendations[0]).toMatchObject({ themeKey: "income_reinforcement", proposedAmount: null, proposedPct: null });
    expect(data.actions[0]).toMatchObject({ actionType: "concentration_check", status: "open" });
  });

  it("ready snapshotがなくても関連テーブルの取得件数を保持する", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: {
          data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" },
          error: null,
        },
        stock_notes_portfolio_snapshots: {
          data: [{ id: "snapshot-1", as_of: "2026-08-14T00:00:00Z", status: "failed", source_type: "broker_csv", imported_at: "2026-08-14T00:01:00Z" }],
          error: null,
        },
        stock_notes_portfolio_accounts: {
          data: [{ id: "account-1", account_name: "特定預り", account_type: "taxable", institution_name: "テスト証券" }],
          error: null,
        },
        stock_notes_portfolio_positions: {
          data: [{ id: "position-failed", account_id: "account-1", instrument_id: "instrument-1", quantity: "1", unit_cost: "1000", quoted_price: "1100", quote_unit: "1", cost_basis: "1000", market_value: "1100", unrealized_pnl: "100", distribution_method: null }],
          error: null,
        },
        stock_notes_portfolio_instruments: {
          data: [
            { id: "instrument-1", asset_type: "domestic_stock", identifier: "9999", name: "テスト銘柄" },
            { id: "instrument-unreferenced", asset_type: "domestic_stock", identifier: "8888", name: "未参照銘柄" },
          ],
          error: null,
        },
        stock_notes_portfolio_reviews: {
          data: { id: "review-1", title: "8月棚卸し", status: "draft", as_of: "2026-08-14T00:02:00Z", new_capital_amount: null, summary: null, allocation_policy: null, updated_at: "2026-08-14T00:02:00Z" },
          error: null,
        },
        stock_notes_portfolio_review_items: {
          data: [{ id: "item-1", instrument_id: "instrument-1", item_status: "reviewed", role_labels: [], stance: null, portfolio_need: null, priority_tier: null, priority_rank: null, target_allocation_pct: null, proposed_new_capital_amount: null, buy_conditions: [], rationale: null, policy_note: null }],
          error: null,
        },
      }),
    );

    expect(data.source).toBe("empty");
    expect(data.currentSnapshot).toBeNull();
    expect(data.dbPositionSnapshot?.id).toBe("snapshot-1");
    expect(data.dbPositions).toHaveLength(1);
    expect(data.dbCounts).toMatchObject({ portfolio: 1, snapshots: 1, accounts: 1, instruments: 2, positions: 1, reviews: 1, reviewItems: 1 });
  });

  it("review周期をまたいだ未完了Actionを取得する", async () => {
    const queryLog: string[] = [];
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: {
          data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" },
          error: null,
        },
        stock_notes_portfolio_snapshots: { data: [], error: null },
        stock_notes_portfolio_accounts: { data: [], error: null },
        stock_notes_portfolio_positions: { data: [], error: null },
        stock_notes_portfolio_reviews: { data: null, error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_instruments: { data: [], error: null },
        stock_notes_portfolio_actions: {
          data: [{ id: "action-old", review_id: "review-old", instrument_id: null, action_type: "review", title: "未完了の持越し確認", detail: "前回reviewからの持越し", trigger_condition: null, due_date: null, status: "open", created_at: "2026-08-14T00:04:00Z", updated_at: "2026-08-14T00:04:00Z" }],
          error: null,
        },
      }, queryLog),
    );

    expect(data.actions[0]).toMatchObject({ id: "action-old", reviewId: "review-old", status: "open" });
    expect(queryLog).toContain("status=open");
  });
});
