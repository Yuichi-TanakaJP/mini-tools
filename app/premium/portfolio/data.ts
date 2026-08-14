import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortfolioAccountType,
  PortfolioData,
  PortfolioPosition,
  PortfolioReview,
  PortfolioReviewItem,
  PortfolioSnapshot,
} from "./types";

type PortfolioRow = {
  id: string;
  name: string;
  base_currency: string;
};

type SnapshotRow = {
  id: string;
  as_of: string;
  status: PortfolioSnapshot["status"];
  source_type: string;
  imported_at: string;
};

type AccountRow = {
  id: string;
  account_name: string;
  account_type: PortfolioAccountType;
  institution_name: string;
};

type InstrumentRow = {
  id: string;
  asset_type: string;
  identifier: string;
  name: string;
};

type PositionRow = {
  id: string;
  account_id: string;
  instrument_id: string;
  quantity: number | string;
  unit_cost: number | string | null;
  quoted_price: number | string | null;
  quote_unit: number | string;
  cost_basis: number | string | null;
  market_value: number | string | null;
  unrealized_pnl: number | string | null;
  distribution_method: string | null;
};

type ReviewRow = {
  id: string;
  title: string;
  status: PortfolioReview["status"];
  as_of: string;
  new_capital_amount: number | string | null;
  summary: string | null;
  allocation_policy: string | null;
  updated_at: string;
};

type ReviewItemRow = {
  id: string;
  instrument_id: string;
  item_status: PortfolioReviewItem["itemStatus"];
  role_labels: unknown;
  stance: string | null;
  portfolio_need: string | null;
  priority_tier: string | null;
  priority_rank: number | null;
  target_allocation_pct: number | string | null;
  proposed_new_capital_amount: number | string | null;
  buy_conditions: unknown;
  rationale: string | null;
  policy_note: string | null;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: number | string | null | undefined): number {
  return numberOrNull(value) ?? 0;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function snapshotFromRow(row: SnapshotRow): PortfolioSnapshot {
  return {
    id: row.id,
    asOf: row.as_of,
    status: row.status,
    sourceType: row.source_type,
    importedAt: row.imported_at,
  };
}

function emptyPortfolio(): PortfolioData {
  return {
    authState: "authenticated",
    portfolio: { id: null, name: null, baseCurrency: "JPY" },
    snapshots: [],
    currentSnapshot: null,
    positions: [],
    review: null,
    source: "empty",
  };
}

export function portfolioAuthRequired(): PortfolioData {
  return { ...emptyPortfolio(), authState: "required" };
}

export async function loadPortfolio(supabase: SupabaseClient): Promise<PortfolioData> {
  const { data: portfolio, error: portfolioError } = await supabase
    .from("stock_notes_portfolios")
    .select("id, name, base_currency")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<PortfolioRow>();
  if (portfolioError) throw portfolioError;
  if (!portfolio) return emptyPortfolio();

  const { data: snapshotRows, error: snapshotsError } = await supabase
    .from("stock_notes_portfolio_snapshots")
    .select("id, as_of, status, source_type, imported_at")
    .eq("portfolio_id", portfolio.id)
    .order("as_of", { ascending: false })
    .order("imported_at", { ascending: false })
    .limit(20)
    .returns<SnapshotRow[]>();
  if (snapshotsError) throw snapshotsError;

  const snapshots = (snapshotRows ?? []).map(snapshotFromRow);
  const currentSnapshot = snapshots.find((snapshot) => snapshot.status === "ready") ?? null;
  if (!currentSnapshot) {
    return {
      ...emptyPortfolio(),
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.base_currency,
      },
      snapshots,
    };
  }

  const [accountsResult, instrumentsResult, positionsResult] = await Promise.all([
    supabase
      .from("stock_notes_portfolio_accounts")
      .select("id, account_name, account_type, institution_name")
      .eq("portfolio_id", portfolio.id)
      .returns<AccountRow[]>(),
    supabase
      .from("stock_notes_portfolio_instruments")
      .select("id, asset_type, identifier, name")
      .returns<InstrumentRow[]>(),
    supabase
      .from("stock_notes_portfolio_positions")
      .select(
        "id, account_id, instrument_id, quantity, unit_cost, quoted_price, quote_unit, cost_basis, market_value, unrealized_pnl, distribution_method",
      )
      .eq("snapshot_id", currentSnapshot.id)
      .returns<PositionRow[]>(),
  ]);
  if (accountsResult.error) throw accountsResult.error;
  if (instrumentsResult.error) throw instrumentsResult.error;
  if (positionsResult.error) throw positionsResult.error;

  const accounts = new Map((accountsResult.data ?? []).map((row) => [row.id, row]));
  const instruments = new Map((instrumentsResult.data ?? []).map((row) => [row.id, row]));
  const positions: PortfolioPosition[] = (positionsResult.data ?? []).flatMap((row) => {
    const account = accounts.get(row.account_id);
    const instrument = instruments.get(row.instrument_id);
    if (!account || !instrument) return [];
    return [
      {
        id: row.id,
        assetType: instrument.asset_type,
        identifier: instrument.identifier,
        name: instrument.name,
        accountName: account.account_name,
        accountType: account.account_type,
        institutionName: account.institution_name,
        quantity: numberOrZero(row.quantity),
        unitCost: numberOrNull(row.unit_cost),
        quotedPrice: numberOrNull(row.quoted_price),
        quoteUnit: numberOrZero(row.quote_unit) || 1,
        costBasis: numberOrNull(row.cost_basis),
        marketValue: numberOrNull(row.market_value),
        unrealizedPnl: numberOrNull(row.unrealized_pnl),
        distributionMethod: row.distribution_method,
      },
    ];
  });

  const { data: reviewRow, error: reviewError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select("id, title, status, as_of, new_capital_amount, summary, allocation_policy, updated_at")
    .eq("portfolio_id", portfolio.id)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (reviewError) throw reviewError;

  let review: PortfolioReview | null = null;
  if (reviewRow) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("stock_notes_portfolio_review_items")
      .select(
        "id, instrument_id, item_status, role_labels, stance, portfolio_need, priority_tier, priority_rank, target_allocation_pct, proposed_new_capital_amount, buy_conditions, rationale, policy_note",
      )
      .eq("review_id", reviewRow.id)
      .returns<ReviewItemRow[]>();
    if (itemsError) throw itemsError;

    review = {
      id: reviewRow.id,
      title: reviewRow.title,
      status: reviewRow.status,
      asOf: reviewRow.as_of,
      newCapitalAmount: numberOrNull(reviewRow.new_capital_amount),
      summary: reviewRow.summary,
      allocationPolicy: reviewRow.allocation_policy,
      updatedAt: reviewRow.updated_at,
      items: (itemRows ?? []).flatMap((row) => {
        const instrument = instruments.get(row.instrument_id);
        if (!instrument) return [];
        return [
          {
            id: row.id,
            identifier: instrument.identifier,
            name: instrument.name,
            itemStatus: row.item_status,
            roleLabels: stringArray(row.role_labels),
            stance: row.stance,
            portfolioNeed: row.portfolio_need,
            priorityTier: row.priority_tier,
            priorityRank: row.priority_rank,
            targetAllocationPct: numberOrNull(row.target_allocation_pct),
            proposedNewCapitalAmount: numberOrNull(row.proposed_new_capital_amount),
            buyConditions: stringArray(row.buy_conditions),
            rationale: row.rationale,
            policyNote: row.policy_note,
          },
        ];
      }),
    };
  }

  return {
    authState: "authenticated",
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.base_currency,
    },
    snapshots,
    currentSnapshot,
    positions,
    review,
    source: "server",
  };
}
