import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortfolioAccountType,
  PortfolioDbPosition,
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
    dbPositionSnapshot: null,
    positions: [],
    dbPositions: [],
    review: null,
    dbCounts: {
      portfolio: 0,
      snapshots: 0,
      accounts: 0,
      instruments: 0,
      positions: 0,
      reviews: 0,
      reviewItems: 0,
    },
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
  const dbPositionSnapshot = currentSnapshot ?? snapshots[0] ?? null;

  const { data: accountData, error: accountsError } = await supabase
    .from("stock_notes_portfolio_accounts")
    .select("id, account_name, account_type, institution_name")
    .eq("portfolio_id", portfolio.id)
    .returns<AccountRow[]>();
  if (accountsError) throw accountsError;

  const accountRows = accountData ?? [];
  let positionRows: PositionRow[] = [];
  if (dbPositionSnapshot) {
    const { data: positionData, error: positionsError } = await supabase
      .from("stock_notes_portfolio_positions")
      .select(
        "id, account_id, instrument_id, quantity, unit_cost, quoted_price, quote_unit, cost_basis, market_value, unrealized_pnl, distribution_method",
      )
      .eq("snapshot_id", dbPositionSnapshot.id)
      .returns<PositionRow[]>();
    if (positionsError) throw positionsError;
    positionRows = positionData ?? [];
  }
  const { data: reviewRow, error: reviewError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select("id, title, status, as_of, new_capital_amount, summary, allocation_policy, updated_at")
    .eq("portfolio_id", portfolio.id)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (reviewError) throw reviewError;

  let reviewItemRows: ReviewItemRow[] = [];
  if (reviewRow) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("stock_notes_portfolio_review_items")
      .select(
        "id, instrument_id, item_status, role_labels, stance, portfolio_need, priority_tier, priority_rank, target_allocation_pct, proposed_new_capital_amount, buy_conditions, rationale, policy_note",
      )
      .eq("review_id", reviewRow.id)
      .returns<ReviewItemRow[]>();
    if (itemsError) throw itemsError;

    reviewItemRows = itemRows ?? [];
  }

  const { data: instrumentData, error: instrumentsError } = await supabase
    .from("stock_notes_portfolio_instruments")
    .select("id, asset_type, identifier, name")
    .returns<InstrumentRow[]>();
  if (instrumentsError) throw instrumentsError;
  const instrumentRows = instrumentData ?? [];

  const accounts = new Map(accountRows.map((row) => [row.id, row]));
  const instruments = new Map(instrumentRows.map((row) => [row.id, row]));
  const dbPositions: PortfolioDbPosition[] = positionRows.map((row) => {
    const account = accounts.get(row.account_id);
    const instrument = instruments.get(row.instrument_id);
    return {
      id: row.id,
      accountId: row.account_id,
      instrumentId: row.instrument_id,
      assetType: instrument?.asset_type ?? null,
      identifier: instrument?.identifier ?? null,
      name: instrument?.name ?? null,
      accountName: account?.account_name ?? null,
      accountType: account?.account_type ?? null,
      institutionName: account?.institution_name ?? null,
      quantity: numberOrZero(row.quantity),
      unitCost: numberOrNull(row.unit_cost),
      quotedPrice: numberOrNull(row.quoted_price),
      quoteUnit: numberOrZero(row.quote_unit) || 1,
      costBasis: numberOrNull(row.cost_basis),
      marketValue: numberOrNull(row.market_value),
      unrealizedPnl: numberOrNull(row.unrealized_pnl),
      distributionMethod: row.distribution_method,
    };
  });
  const positions: PortfolioPosition[] = dbPositions.flatMap((position) => {
    if (!position.assetType || !position.identifier || !position.name || !position.accountName || !position.accountType || !position.institutionName) return [];
    return [position as PortfolioPosition];
  });

  let review: PortfolioReview | null = null;
  if (reviewRow) {
    review = {
      id: reviewRow.id,
      title: reviewRow.title,
      status: reviewRow.status,
      asOf: reviewRow.as_of,
      newCapitalAmount: numberOrNull(reviewRow.new_capital_amount),
      summary: reviewRow.summary,
      allocationPolicy: reviewRow.allocation_policy,
      updatedAt: reviewRow.updated_at,
      items: reviewItemRows.flatMap((row) => {
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
    dbPositionSnapshot,
    positions,
    dbPositions,
    review,
    dbCounts: {
      portfolio: 1,
      snapshots: snapshots.length,
      accounts: accountRows.length,
      instruments: instrumentRows.length,
      positions: positionRows.length,
      reviews: reviewRow ? 1 : 0,
      reviewItems: reviewItemRows.length,
    },
    source: currentSnapshot ? "server" : "empty",
  };
}
