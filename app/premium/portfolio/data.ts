import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortfolioAccountType,
  PortfolioDbPosition,
  PortfolioData,
  PortfolioPosition,
  PortfolioAction,
  PortfolioPolicy,
  PortfolioRecommendation,
  PortfolioReflection,
  PortfolioReview,
  PortfolioReviewHistoryItem,
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
  policy_version_id: string | null;
  snapshot_id: string | null;
  title: string;
  status: PortfolioReview["status"];
  as_of: string;
  new_capital_amount: number | string | null;
  summary: string | null;
  allocation_policy: string | null;
  supersede_reason: string | null;
  updated_at: string;
};

type ReviewIdRow = { id: string };

type PolicyRow = {
  id: string;
  version_number: number;
  status: PortfolioPolicy["status"];
  title: string;
  objective: string | null;
  time_horizon: string | null;
  income_priority: string | null;
  capital_growth_priority: string | null;
  risk_statement: string | null;
  cash_policy: string | null;
  buy_policy: string | null;
  sell_policy: string | null;
  principles: unknown;
  constraints: unknown;
  change_reason: string | null;
  based_on_policy_id: string | null;
  effective_from: string | null;
  created_at: string;
  updated_at: string;
};

type PolicyRuleRow = {
  id: string;
  policy_version_id: string;
  dimension: string;
  target_key: string;
  min_pct: number | string | null;
  max_pct: number | string | null;
  priority: string;
  rationale: string | null;
};

type ReflectionRow = {
  id: string;
  review_id: string;
  as_of: string;
  expected_outcome: string | null;
  actual_outcome: string | null;
  worked_well: unknown;
  did_not_work: unknown;
  missed_risks: unknown;
  lessons: unknown;
  policy_change_recommended: boolean;
  policy_change_summary: string | null;
  created_at: string;
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

type RecommendationRow = {
  id: string;
  review_id: string;
  target_type: PortfolioRecommendation["targetType"];
  instrument_id: string | null;
  stock_id: string | null;
  theme_key: string | null;
  recommendation_type: PortfolioRecommendation["recommendationType"];
  priority_tier: PortfolioRecommendation["priorityTier"];
  priority_rank: number | null;
  proposed_amount: number | string | null;
  proposed_pct: number | string | null;
  conditions: unknown;
  rationale: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type ActionRow = {
  id: string;
  review_id: string | null;
  instrument_id: string | null;
  action_type: PortfolioAction["actionType"];
  title: string;
  detail: string | null;
  trigger_condition: string | null;
  due_date: string | null;
  status: PortfolioAction["status"];
  created_at: string;
  updated_at: string;
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

function policyFromRow(row: PolicyRow, rules: PolicyRuleRow[]): PortfolioPolicy {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    title: row.title,
    objective: row.objective,
    timeHorizon: row.time_horizon,
    incomePriority: row.income_priority,
    capitalGrowthPriority: row.capital_growth_priority,
    riskStatement: row.risk_statement,
    cashPolicy: row.cash_policy,
    buyPolicy: row.buy_policy,
    sellPolicy: row.sell_policy,
    principles: stringArray(row.principles),
    constraints: stringArray(row.constraints),
    changeReason: row.change_reason,
    basedOnPolicyId: row.based_on_policy_id,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rules: rules.map((rule) => ({
      id: rule.id,
      dimension: rule.dimension,
      targetKey: rule.target_key,
      minPct: numberOrNull(rule.min_pct),
      maxPct: numberOrNull(rule.max_pct),
      priority: rule.priority,
      rationale: rule.rationale,
    })),
  };
}

function reflectionFromRow(row: ReflectionRow): PortfolioReflection {
  return {
    id: row.id,
    reviewId: row.review_id,
    asOf: row.as_of,
    expectedOutcome: row.expected_outcome,
    actualOutcome: row.actual_outcome,
    workedWell: stringArray(row.worked_well),
    didNotWork: stringArray(row.did_not_work),
    missedRisks: stringArray(row.missed_risks),
    lessons: stringArray(row.lessons),
    policyChangeRecommended: row.policy_change_recommended,
    policyChangeSummary: row.policy_change_summary,
    createdAt: row.created_at,
  };
}

function reviewHistoryFromRow(row: ReviewRow): PortfolioReviewHistoryItem {
  return {
    id: row.id,
    policyVersionId: row.policy_version_id,
    snapshotId: row.snapshot_id,
    title: row.title,
    status: row.status,
    asOf: row.as_of,
    newCapitalAmount: numberOrNull(row.new_capital_amount),
    supersedeReason: row.supersede_reason ?? null,
    updatedAt: row.updated_at,
  };
}

function compareReviewHistory(a: PortfolioReviewHistoryItem, b: PortfolioReviewHistoryItem) {
  return b.asOf.localeCompare(a.asOf) || b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id);
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
    reviewHistory: [],
    activePolicy: null,
    policyHistory: [],
    latestReflection: null,
    reflections: [],
    recommendations: [],
    actions: [],
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
  const reviewSelect = "id, policy_version_id, snapshot_id, title, status, as_of, new_capital_amount, summary, allocation_policy, supersede_reason, updated_at";
  const { data: reviewRows, error: reviewError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select(reviewSelect)
    .eq("portfolio_id", portfolio.id)
    .order("as_of", { ascending: false })
    .limit(20)
    .returns<ReviewRow[]>();
  if (reviewError) throw reviewError;
  const { data: draftReviewRow, error: draftReviewError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select(reviewSelect)
    .eq("portfolio_id", portfolio.id)
    .eq("status", "draft")
    .order("as_of", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (draftReviewError) throw draftReviewError;
  let currentReviewRow = draftReviewRow;
  if (!currentReviewRow) {
    const { data: finalizedReviewRow, error: finalizedReviewError } = await supabase
      .from("stock_notes_portfolio_reviews")
      .select(reviewSelect)
      .eq("portfolio_id", portfolio.id)
      .eq("status", "finalized")
      .order("as_of", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<ReviewRow>();
    if (finalizedReviewError) throw finalizedReviewError;
    currentReviewRow = finalizedReviewRow;
  }
  const reviewRowsWithCurrent = currentReviewRow && !(reviewRows ?? []).some((row) => row.id === currentReviewRow.id)
    ? [...(reviewRows ?? []), currentReviewRow]
    : reviewRows ?? [];
  const reviewHistoryItems = reviewRowsWithCurrent.map(reviewHistoryFromRow).sort(compareReviewHistory);
  const recentReviewHistory = reviewHistoryItems.slice(0, 20);
  const currentReviewHistory = currentReviewRow ? reviewHistoryItems.find((review) => review.id === currentReviewRow.id) ?? null : null;
  const reviewHistory = currentReviewHistory && !recentReviewHistory.some((review) => review.id === currentReviewHistory.id)
    ? [...recentReviewHistory.slice(0, -1), currentReviewHistory].sort(compareReviewHistory)
    : recentReviewHistory;
  const reviewRow = currentReviewRow ?? null;
  const { data: supersededReviewRows, error: supersededReviewsError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select("id")
    .eq("portfolio_id", portfolio.id)
    .eq("status", "superseded")
    .returns<ReviewIdRow[]>();
  if (supersededReviewsError) throw supersededReviewsError;
  const supersededReviewIds = new Set((supersededReviewRows ?? []).map((row) => row.id));
  const { count: reviewCountFromDb, error: reviewCountError } = await supabase
    .from("stock_notes_portfolio_reviews")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolio.id);
  if (reviewCountError) throw reviewCountError;

  const { data: policyData, error: policiesError } = await supabase
    .from("stock_notes_portfolio_policy_versions")
    .select(
      "id, version_number, status, title, objective, time_horizon, income_priority, capital_growth_priority, risk_statement, cash_policy, buy_policy, sell_policy, principles, constraints, change_reason, based_on_policy_id, effective_from, created_at, updated_at",
    )
    .eq("portfolio_id", portfolio.id)
    .order("version_number", { ascending: false })
    .limit(20)
    .returns<PolicyRow[]>();
  if (policiesError) throw policiesError;

  let policyRows = policyData ?? [];
  const referencedPolicyIds = [...new Set((reviewRowsWithCurrent ?? []).map((row) => row.policy_version_id).filter((id): id is string => Boolean(id)))];
  const missingReferencedPolicyIds = referencedPolicyIds.filter((id) => !policyRows.some((row) => row.id === id));
  if (missingReferencedPolicyIds.length > 0) {
    const { data: referencedPolicies, error: referencedPoliciesError } = await supabase
      .from("stock_notes_portfolio_policy_versions")
      .select(
        "id, version_number, status, title, objective, time_horizon, income_priority, capital_growth_priority, risk_statement, cash_policy, buy_policy, sell_policy, principles, constraints, change_reason, based_on_policy_id, effective_from, created_at, updated_at",
      )
      .in("id", missingReferencedPolicyIds)
      .returns<PolicyRow[]>();
    if (referencedPoliciesError) throw referencedPoliciesError;
    policyRows = [...policyRows, ...(referencedPolicies ?? [])];
  }
  const policyIds = policyRows.map((row) => row.id);
  const { data: policyRuleData, error: policyRulesError } = policyIds.length > 0
    ? await supabase
      .from("stock_notes_portfolio_policy_rules")
      .select("id, policy_version_id, dimension, target_key, min_pct, max_pct, priority, rationale")
      .in("policy_version_id", policyIds)
      .order("dimension", { ascending: true })
      .order("target_key", { ascending: true })
      .returns<PolicyRuleRow[]>()
    : { data: [], error: null };
  if (policyRulesError) throw policyRulesError;

  const rulesByPolicy = new Map<string, PolicyRuleRow[]>();
  for (const rule of policyRuleData ?? []) {
    const rules = rulesByPolicy.get(rule.policy_version_id) ?? [];
    rules.push(rule);
    rulesByPolicy.set(rule.policy_version_id, rules);
  }
  const policyHistory = policyRows.map((row) => policyFromRow(row, rulesByPolicy.get(row.id) ?? []));
  const activePolicy = policyHistory.find((policy) => policy.status === "active") ?? null;

  const reflectionSelect = "id, review_id, as_of, expected_outcome, actual_outcome, worked_well, did_not_work, missed_risks, lessons, policy_change_recommended, policy_change_summary, created_at";
  const { data: reflectionData, error: reflectionsError } = await supabase
    .from("stock_notes_portfolio_reflections")
    .select(reflectionSelect)
    .eq("portfolio_id", portfolio.id)
    .order("as_of", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<ReflectionRow[]>();
  if (reflectionsError) throw reflectionsError;
  const reflections = (reflectionData ?? []).map(reflectionFromRow);

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

  const { data: recommendationData, error: recommendationsError } = reviewRow
    ? await supabase
      .from("stock_notes_portfolio_recommendations")
      .select("id, review_id, target_type, instrument_id, stock_id, theme_key, recommendation_type, priority_tier, priority_rank, proposed_amount, proposed_pct, conditions, rationale, rejection_reason, created_at, updated_at")
      .eq("review_id", reviewRow.id)
      .order("priority_rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .returns<RecommendationRow[]>()
    : { data: [], error: null };
  if (recommendationsError) throw recommendationsError;

  let actionQuery = supabase
    .from("stock_notes_portfolio_actions")
    .select("id, review_id, instrument_id, action_type, title, detail, trigger_condition, due_date, status, created_at, updated_at")
    .eq("portfolio_id", portfolio.id)
    .eq("status", "open");
  const { data: actionData, error: actionsError } = await actionQuery
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ActionRow[]>();
  if (actionsError) throw actionsError;

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
      policyVersionId: reviewRow.policy_version_id,
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

  const recommendations: PortfolioRecommendation[] = (recommendationData ?? []).map((row) => {
    const instrument = row.instrument_id ? instruments.get(row.instrument_id) : undefined;
    return {
      id: row.id,
      reviewId: row.review_id,
      targetType: row.target_type,
      instrumentId: row.instrument_id,
      instrumentIdentifier: instrument?.identifier ?? null,
      instrumentName: instrument?.name ?? null,
      stockId: row.stock_id,
      themeKey: row.theme_key,
      recommendationType: row.recommendation_type,
      priorityTier: row.priority_tier,
      priorityRank: row.priority_rank,
      proposedAmount: numberOrNull(row.proposed_amount),
      proposedPct: numberOrNull(row.proposed_pct),
      conditions: stringArray(row.conditions),
      rationale: row.rationale,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const actions: PortfolioAction[] = (actionData ?? []).filter((row) => !row.review_id || !supersededReviewIds.has(row.review_id)).map((row) => {
    const instrument = row.instrument_id ? instruments.get(row.instrument_id) : undefined;
    return {
      id: row.id,
      reviewId: row.review_id,
      instrumentId: row.instrument_id,
      instrumentIdentifier: instrument?.identifier ?? null,
      instrumentName: instrument?.name ?? null,
      actionType: row.action_type,
      title: row.title,
      detail: row.detail,
      triggerCondition: row.trigger_condition,
      dueDate: row.due_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

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
    reviewHistory,
    activePolicy,
    policyHistory,
    latestReflection: reflections[0] ?? null,
    reflections,
    recommendations,
    actions,
    dbCounts: {
      portfolio: 1,
      snapshots: snapshots.length,
      accounts: accountRows.length,
      instruments: instrumentRows.length,
      positions: positionRows.length,
      reviews: reviewCountFromDb ?? (reviewRows ?? []).length,
      reviewItems: reviewItemRows.length,
    },
    source: currentSnapshot ? "server" : "empty",
  };
}
