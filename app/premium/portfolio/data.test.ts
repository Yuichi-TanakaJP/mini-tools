import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPortfolio, portfolioAuthRequired } from "./data";

class QueryStub {
  private predicates: Array<{ column: string; matches: (value: unknown) => boolean }> = [];

  constructor(private readonly result: unknown, private readonly queryLog: string[] = []) {}

  select() {
    return this;
  }

  eq(column?: string, value?: unknown) {
    if (column === "status" && value === "open") this.queryLog.push("status=open");
    if (column === "status" || column === "portfolio_scope" || column === "snapshot_id") {
      this.predicates.push({ column, matches: (candidate) => candidate === value });
    }
    return this;
  }

  or(filter?: string) {
    if (filter === "portfolio_scope.eq.official,portfolio_scope.is.null") {
      this.predicates.push({ column: "portfolio_scope", matches: (candidate) => candidate === "official" || candidate === null || candidate === undefined });
    }
    return this;
  }

  in(column?: string, values?: unknown[]) {
    if (column === "status") this.predicates.push({ column, matches: (candidate) => values?.includes(candidate) ?? false });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    const result = this.filteredResult() as { data?: unknown; error?: unknown };
    return Promise.resolve(Array.isArray(result.data) ? { ...result, data: result.data[0] ?? null } : this.result);
  }

  returns() {
    return Promise.resolve(this.filteredResult());
  }

  private filteredResult() {
    const result = this.result as { data?: unknown; error?: unknown };
    if (this.predicates.length === 0 || !Array.isArray(result.data)) return this.result;
    return {
      ...result,
      data: result.data.filter((row) => this.predicates.every(({ column, matches }) => {
        const record = row as Record<string, unknown>;
        // Older fixtures omit snapshot_id because the old loader did not need it.
        if (column === "snapshot_id" && !Object.prototype.hasOwnProperty.call(record, column)) return true;
        // Before portfolio_scope was added, every stored snapshot was official.
        if (column === "portfolio_scope" && !Object.prototype.hasOwnProperty.call(record, column)) return matches("official");
        return matches(record[column]);
      })),
    };
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
          data: [{ id: "review-1", policy_version_id: "policy-2", snapshot_id: "snapshot-1", title: "8月棚卸し", status: "draft", as_of: "2026-08-14T00:02:00Z", new_capital_amount: "100000", summary: "分散を維持", allocation_policy: "押し目を待つ", updated_at: "2026-08-14T00:02:00Z" }],
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
          data: [{ id: "reflection-1", review_id: "review-1", as_of: "2026-08-20T00:00:00Z", expected_outcome: "分散を維持", actual_outcome: "集中は許容範囲", worked_well: ["業種分散"], did_not_work: [], missed_risks: ["未分類商品"], lessons: ["分類の鮮度を確認する"], policy_change_recommended: true, policy_change_summary: "分類確認を定期化", created_at: "2026-08-20T00:00:00Z" }],
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
    expect(data.positions).toHaveLength(2);
    expect(data.positions[1]).toMatchObject({ id: "position-2", accountName: "account-missing", accountType: "other", institutionName: "不明" });
    expect(data.dbPositions).toHaveLength(2);
    expect(data.dbPositions[1]).toMatchObject({ id: "position-2", accountName: null, accountId: "account-missing" });
    expect(data.review?.items[0]).toMatchObject({ stance: "hold", targetAllocationPct: 10, buyConditions: ["押し目"] });
    expect(data.reviewHistory).toHaveLength(1);
    expect(data.reviewHistory[0]).toMatchObject({ id: "review-1", status: "draft", snapshotId: "snapshot-1" });
    expect(data.review?.policyVersionId).toBe("policy-2");
    expect(data.activePolicy).toMatchObject({ versionNumber: 2, status: "active", title: "高配当を軸に成長も重視" });
    expect(data.activePolicy?.rules[0]).toMatchObject({ dimension: "cycle_profile", targetKey: "cyclical", minPct: 70, maxPct: 70 });
    expect(data.latestReflection).toMatchObject({ policyChangeRecommended: true, lessons: ["分類の鮮度を確認する"] });
    expect(data.recommendations[0]).toMatchObject({ themeKey: "income_reinforcement", proposedAmount: null, proposedPct: null });
    expect(data.actions[0]).toMatchObject({ actionType: "concentration_check", status: "open" });
  });

  it("外部参照snapshotを公式保有と分け、残高方式を読み取る", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_snapshots: {
          data: [
            { id: "external-snapshot", as_of: "2026-08-18T00:00:00Z", status: "ready", source_type: "manual", imported_at: "2026-08-18T00:01:00Z", portfolio_scope: "external_reference", note: "iDeCo明細" },
            { id: "official-snapshot", as_of: "2026-08-14T00:00:00Z", status: "ready", source_type: "broker_csv", imported_at: "2026-08-14T00:01:00Z", portfolio_scope: "official", note: null },
          ],
          error: null,
        },
        stock_notes_portfolio_accounts: {
          data: [
            { id: "account-official", account_name: "証券口座", account_type: "taxable", institution_name: "証券会社", withdrawal_profile: "immediate" },
            { id: "account-external", account_name: "iDeCo", account_type: "ideco", institution_name: "年金運営会社", withdrawal_profile: "retirement_locked" },
          ],
          error: null,
        },
        stock_notes_portfolio_instruments: {
          data: [{ id: "instrument-external", asset_type: "investment_fund", identifier: "IDEC0-FUND", name: "iDeCoファンド", stock_id: null }],
          error: null,
        },
        stock_notes_portfolio_positions: {
          data: [
            { id: "official-position", snapshot_id: "official-snapshot", account_id: "account-official", instrument_id: "instrument-external", quantity: "10", unit_cost: "1000", quoted_price: "1100", quote_unit: "1", cost_basis: "10000", market_value: "11000", unrealized_pnl: "1000", distribution_method: null },
            { id: "external-position", snapshot_id: "external-snapshot", account_id: "account-external", instrument_id: "instrument-external", quantity: null, unit_cost: null, quoted_price: null, quote_unit: "1", cost_basis: null, market_value: "550000", unrealized_pnl: null, distribution_method: null, valuation_mode: "balance", native_market_value: "550000", native_currency: "JPY", cost_basis_native: null, fx_rate: null, fx_as_of: null, fx_source: null, note: "残高として登録" },
          ],
          error: null,
        },
        stock_notes_portfolio_reviews: { data: [], error: null },
        stock_notes_portfolio_policy_versions: { data: [], error: null },
        stock_notes_portfolio_policy_rules: { data: [], error: null },
        stock_notes_portfolio_reflections: { data: [], error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_recommendations: { data: [], error: null },
        stock_notes_portfolio_actions: { data: [], error: null },
      }),
    );

    expect(data.currentSnapshot?.id).toBe("official-snapshot");
    expect(data.dbPositionSnapshot?.id).toBe("official-snapshot");
    expect(data.dbPositions).toHaveLength(1);
    expect(data.externalAssets).toMatchObject({ status: "loaded", totalMarketValue: 550000, unresolvedInstrumentCount: 0 });
    expect(data.externalAssets.snapshot).toMatchObject({ id: "external-snapshot", portfolioScope: "external_reference", sourceLabel: "iDeCo明細" });
    expect(data.externalAssets.positions[0]).toMatchObject({ valuationMode: "balance", quantity: null, accountType: "ideco", withdrawalProfile: "retirement_locked" });
  });

  it("外部資産だけでは公式ポートフォリオを読み込み済みにしない", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_snapshots: {
          data: [{ id: "external-snapshot", as_of: "2026-08-18T00:00:00Z", status: "ready", source_type: "manual", imported_at: "2026-08-18T00:01:00Z", portfolio_scope: "external_reference", note: "暗号資産" }],
          error: null,
        },
        stock_notes_portfolio_accounts: { data: [{ id: "account-external", account_name: "暗号資産口座", account_type: "crypto_exchange", institution_name: "取引所", withdrawal_profile: "immediate" }], error: null },
        stock_notes_portfolio_instruments: { data: [{ id: "instrument-crypto", asset_type: "crypto", identifier: "BTC", name: "Bitcoin", stock_id: null }], error: null },
        stock_notes_portfolio_positions: { data: [{ id: "external-position", snapshot_id: "external-snapshot", account_id: "account-external", instrument_id: "instrument-crypto", quantity: "0.1", unit_cost: null, quoted_price: null, quote_unit: "1", cost_basis: null, market_value: "1000000", unrealized_pnl: null, distribution_method: null, valuation_mode: "quantity", native_market_value: "1000000", native_currency: "JPY" }], error: null },
        stock_notes_portfolio_reviews: { data: [], error: null },
        stock_notes_portfolio_policy_versions: { data: [], error: null },
        stock_notes_portfolio_policy_rules: { data: [], error: null },
        stock_notes_portfolio_reflections: { data: [], error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_recommendations: { data: [], error: null },
        stock_notes_portfolio_actions: { data: [], error: null },
      }),
    );

    expect(data.source).toBe("empty");
    expect(data.currentSnapshot).toBeNull();
    expect(data.positions).toEqual([]);
    expect(data.externalAssets.status).toBe("loaded");
    expect(data.snapshots).toEqual([]);
    expect(data.externalSnapshots).toMatchObject([{ id: "external-snapshot", portfolioScope: "external_reference" }]);
  });

  it("portfolio_scope未設定の旧snapshotを公式保有として読み取る", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_snapshots: {
          data: [{ id: "legacy-snapshot", as_of: "2026-08-14T00:00:00Z", status: "ready", source_type: "broker_csv", imported_at: "2026-08-14T00:01:00Z" }],
          error: null,
        },
        stock_notes_portfolio_accounts: { data: [], error: null },
        stock_notes_portfolio_positions: { data: [], error: null },
        stock_notes_portfolio_reviews: { data: [], error: null },
        stock_notes_portfolio_policy_versions: { data: [], error: null },
        stock_notes_portfolio_policy_rules: { data: [], error: null },
        stock_notes_portfolio_reflections: { data: [], error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_recommendations: { data: [], error: null },
        stock_notes_portfolio_actions: { data: [], error: null },
        stock_notes_portfolio_instruments: { data: [], error: null },
      }),
    );

    expect(data.currentSnapshot?.id).toBe("legacy-snapshot");
    expect(data.currentSnapshot?.portfolioScope).toBe("official");
    expect(data.source).toBe("server");
  });

  it("最新の外部取込が失敗中でも、最後に成功したsnapshotを警告付きで表示する", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_snapshots: {
          data: [
            { id: "external-failed", as_of: "2026-08-20T00:00:00Z", status: "failed", source_type: "manual", imported_at: "2026-08-20T00:01:00Z", portfolio_scope: "external_reference", note: "最新取込" },
            { id: "external-ready", as_of: "2026-08-18T00:00:00Z", status: "ready", source_type: "manual", imported_at: "2026-08-18T00:01:00Z", portfolio_scope: "external_reference", note: "前回取込" },
          ],
          error: null,
        },
        stock_notes_portfolio_accounts: { data: [], error: null },
        stock_notes_portfolio_positions: { data: [], error: null },
        stock_notes_portfolio_reviews: { data: [], error: null },
        stock_notes_portfolio_policy_versions: { data: [], error: null },
        stock_notes_portfolio_policy_rules: { data: [], error: null },
        stock_notes_portfolio_reflections: { data: [], error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_recommendations: { data: [], error: null },
        stock_notes_portfolio_actions: { data: [], error: null },
        stock_notes_portfolio_instruments: { data: [], error: null },
      }),
    );

    expect(data.externalAssets).toMatchObject({
      status: "error",
      snapshot: { id: "external-ready", status: "ready" },
      errorMessage: "最新の外部資産取込に失敗しています。表示中の明細は最後に成功したsnapshotです。",
    });
  });

  it("superseded reviewを現行判断から除外し、履歴には残す", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_snapshots: { data: [{ id: "snapshot-1", as_of: "2026-08-14T00:00:00Z", status: "ready", source_type: "broker_csv", imported_at: "2026-08-14T00:01:00Z" }], error: null },
        stock_notes_portfolio_accounts: { data: [], error: null },
        stock_notes_portfolio_positions: { data: [], error: null },
        stock_notes_portfolio_reviews: { data: [{ id: "review-old", policy_version_id: "policy-v1", snapshot_id: "snapshot-1", title: "旧v1 review", status: "superseded", as_of: "2026-08-10T00:00:00Z", new_capital_amount: null, summary: "旧方針の途中案", allocation_policy: null, supersede_reason: "active policy更新により現行reviewを置き換えたため", updated_at: "2026-08-11T00:00:00Z" }], error: null },
        stock_notes_portfolio_policy_versions: { data: [], error: null },
        stock_notes_portfolio_policy_rules: { data: [], error: null },
        stock_notes_portfolio_reflections: { data: [{ id: "reflection-old", review_id: "review-old", as_of: "2026-08-12T00:00:00Z", expected_outcome: "旧reviewの想定", actual_outcome: null, worked_well: [], did_not_work: [], missed_risks: [], lessons: ["旧方針の学び"], policy_change_recommended: false, policy_change_summary: null, created_at: "2026-08-12T00:00:00Z" }], error: null },
        stock_notes_portfolio_review_items: { data: [], error: null },
        stock_notes_portfolio_recommendations: { data: [], error: null },
        stock_notes_portfolio_actions: { data: [{ id: "action-old", review_id: "review-old", instrument_id: null, action_type: "review", title: "旧reviewの確認", detail: null, trigger_condition: null, due_date: null, status: "open", created_at: "2026-08-10T00:00:00Z", updated_at: "2026-08-10T00:00:00Z" }], error: null },
        stock_notes_portfolio_instruments: { data: [], error: null },
      }),
    );

    expect(data.review).toBeNull();
    expect(data.reviewHistory).toMatchObject([{ id: "review-old", status: "superseded", supersedeReason: "active policy更新により現行reviewを置き換えたため" }]);
    expect(data.latestReflection).toMatchObject({ id: "reflection-old", reviewId: "review-old" });
    expect(data.actions).toEqual([]);
    expect(data.dbCounts.reviews).toBe(1);
  });

  it("基準日が新しい確定reviewより現行draftを優先する", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_reviews: {
          data: [
            { id: "review-finalized", policy_version_id: "policy-1", snapshot_id: "snapshot-new", title: "確定済みreview", status: "finalized", as_of: "2026-08-20T00:00:00Z", new_capital_amount: null, summary: null, allocation_policy: null, supersede_reason: null, updated_at: "2026-08-20T00:01:00Z" },
            { id: "review-draft", policy_version_id: "policy-2", snapshot_id: "snapshot-old", title: "現行draft", status: "draft", as_of: "2026-08-20T00:00:00Z", new_capital_amount: null, summary: null, allocation_policy: null, supersede_reason: null, updated_at: "2026-08-20T00:02:00Z" },
          ],
          error: null,
        },
        stock_notes_portfolio_actions: {
          data: [
            { id: "action-finalized", review_id: "review-finalized", instrument_id: null, action_type: "review", title: "旧reviewのAction", detail: null, trigger_condition: null, due_date: null, status: "open", created_at: "2026-08-20T00:03:00Z", updated_at: "2026-08-20T00:03:00Z" },
            { id: "action-draft", review_id: "review-draft", instrument_id: null, action_type: "review", title: "現行draftのAction", detail: null, trigger_condition: null, due_date: null, status: "open", created_at: "2026-08-20T00:04:00Z", updated_at: "2026-08-20T00:04:00Z" },
            { id: "action-portfolio", review_id: null, instrument_id: null, action_type: "review", title: "ポートフォリオ全体Action", detail: null, trigger_condition: null, due_date: null, status: "open", created_at: "2026-08-20T00:05:00Z", updated_at: "2026-08-20T00:05:00Z" },
          ],
          error: null,
        },
      }),
    );

    expect(data.review?.id).toBe("review-draft");
    expect(data.reviewHistory[0]?.id).toBe("review-draft");
    expect(data.actions.map((action) => action.id)).toEqual(["action-finalized", "action-draft", "action-portfolio"]);
  });

  it("最新の振り返りは時間順で選び、reviewの状態にかかわらず履歴を残す", async () => {
    const data = await loadPortfolio(
      stubClient({
        stock_notes_portfolios: { data: { id: "portfolio-1", name: "メイン", base_currency: "JPY" }, error: null },
        stock_notes_portfolio_reviews: {
          data: [
            { id: "review-finalized", policy_version_id: "policy-1", snapshot_id: null, title: "確定review", status: "finalized", as_of: "2026-08-20T00:00:00Z", new_capital_amount: null, summary: null, allocation_policy: null, supersede_reason: null, updated_at: "2026-08-20T00:01:00Z" },
            { id: "review-draft", policy_version_id: "policy-2", snapshot_id: null, title: "現行draft", status: "draft", as_of: "2026-08-01T00:00:00Z", new_capital_amount: null, summary: null, allocation_policy: null, supersede_reason: null, updated_at: "2026-08-21T00:01:00Z" },
            { id: "review-superseded", policy_version_id: "policy-0", snapshot_id: null, title: "置換済みreview", status: "superseded", as_of: "2026-08-21T00:00:00Z", new_capital_amount: null, summary: null, allocation_policy: null, supersede_reason: "新reviewへ置換", updated_at: "2026-08-21T00:01:00Z" },
          ],
          error: null,
        },
        stock_notes_portfolio_reflections: {
          data: [
            { id: "reflection-superseded", review_id: "review-superseded", as_of: "2026-08-22T00:00:00Z", expected_outcome: "置換済みの期待", actual_outcome: null, worked_well: [], did_not_work: [], missed_risks: [], lessons: ["最新の学び"], policy_change_recommended: false, policy_change_summary: null, created_at: "2026-08-22T00:01:00Z" },
            { id: "reflection-new", review_id: "review-finalized", as_of: "2026-08-20T00:00:00Z", expected_outcome: "新しい期待", actual_outcome: null, worked_well: [], did_not_work: [], missed_risks: [], lessons: ["確定reviewの学び"], policy_change_recommended: false, policy_change_summary: null, created_at: "2026-08-20T00:01:00Z" },
            { id: "reflection-old", review_id: "review-draft", as_of: "2026-08-10T00:00:00Z", expected_outcome: "古い期待", actual_outcome: null, worked_well: [], did_not_work: [], missed_risks: [], lessons: ["古い学び"], policy_change_recommended: false, policy_change_summary: null, created_at: "2026-08-10T00:01:00Z" },
          ],
          error: null,
        },
      }),
    );

    expect(data.latestReflection?.id).toBe("reflection-superseded");
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
          data: [{ id: "review-1", policy_version_id: null, snapshot_id: "snapshot-1", title: "8月棚卸し", status: "draft", as_of: "2026-08-14T00:02:00Z", new_capital_amount: null, summary: null, allocation_policy: null, updated_at: "2026-08-14T00:02:00Z" }],
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
