import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPortfolio, portfolioAuthRequired } from "./data";

class QueryStub {
  constructor(private readonly result: unknown) {}

  select() {
    return this;
  }

  eq() {
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

function stubClient(results: Record<string, unknown>) {
  return {
    from(table: string) {
      return new QueryStub(results[table] ?? { data: [], error: null });
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
        stock_notes_portfolio_review_items: {
          data: [{ id: "item-1", instrument_id: "instrument-1", item_status: "reviewed", role_labels: ["高配当"], stance: "hold", portfolio_need: "maintain", priority_tier: "medium", priority_rank: 1, target_allocation_pct: "10", proposed_new_capital_amount: "0", buy_conditions: ["押し目"], rationale: "役割は十分", policy_note: null }],
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
});
