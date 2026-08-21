export type PortfolioAccountType =
  | "taxable"
  | "nisa_growth"
  | "nisa_accumulation"
  | "legacy_nisa"
  | "pension"
  | "other";

export type PortfolioSnapshot = {
  id: string;
  asOf: string;
  status: "ready" | "superseded" | "failed" | "importing";
  sourceType: string;
  importedAt: string;
};

export type PortfolioPosition = {
  id: string;
  accountId: string;
  instrumentId: string;
  assetType: string;
  identifier: string;
  name: string;
  accountName: string;
  accountType: PortfolioAccountType;
  institutionName: string;
  quantity: number;
  unitCost: number | null;
  quotedPrice: number | null;
  quoteUnit: number;
  costBasis: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  distributionMethod: string | null;
};

export type PortfolioReviewItem = {
  id: string;
  identifier: string;
  name: string;
  itemStatus: "pending" | "reviewed" | "excluded";
  roleLabels: string[];
  stance: string | null;
  portfolioNeed: string | null;
  priorityTier: string | null;
  priorityRank: number | null;
  targetAllocationPct: number | null;
  proposedNewCapitalAmount: number | null;
  buyConditions: string[];
  rationale: string | null;
  policyNote: string | null;
};

export type PortfolioReview = {
  id: string;
  policyVersionId: string | null;
  title: string;
  status: "draft" | "finalized";
  asOf: string;
  newCapitalAmount: number | null;
  summary: string | null;
  allocationPolicy: string | null;
  updatedAt: string;
  items: PortfolioReviewItem[];
};

export type PortfolioPolicyRule = {
  id: string;
  dimension: string;
  targetKey: string;
  minPct: number | null;
  maxPct: number | null;
  priority: string;
  rationale: string | null;
};

export type PortfolioPolicy = {
  id: string;
  versionNumber: number;
  status: "draft" | "active" | "superseded";
  title: string;
  objective: string | null;
  timeHorizon: string | null;
  incomePriority: string | null;
  capitalGrowthPriority: string | null;
  riskStatement: string | null;
  cashPolicy: string | null;
  buyPolicy: string | null;
  sellPolicy: string | null;
  principles: string[];
  constraints: string[];
  changeReason: string | null;
  basedOnPolicyId: string | null;
  effectiveFrom: string | null;
  createdAt: string;
  updatedAt: string;
  rules: PortfolioPolicyRule[];
};

export type PortfolioReflection = {
  id: string;
  reviewId: string;
  asOf: string;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  workedWell: string[];
  didNotWork: string[];
  missedRisks: string[];
  lessons: string[];
  policyChangeRecommended: boolean;
  policyChangeSummary: string | null;
  createdAt: string;
};

export type PortfolioRecommendation = {
  id: string;
  reviewId: string;
  targetType: "holding" | "candidate_stock" | "theme" | "cash";
  instrumentId: string | null;
  instrumentIdentifier: string | null;
  instrumentName: string | null;
  stockId: string | null;
  themeKey: string | null;
  recommendationType: "reinforce" | "new_position" | "maintain" | "wait" | "reduce" | "research";
  priorityTier: "high" | "medium" | "low" | null;
  priorityRank: number | null;
  proposedAmount: number | null;
  proposedPct: number | null;
  conditions: string[];
  rationale: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAction = {
  id: string;
  reviewId: string | null;
  instrumentId: string | null;
  instrumentIdentifier: string | null;
  instrumentName: string | null;
  actionType: "review" | "allocation_wait" | "staged_investment" | "price_check" | "yield_check" | "earnings_check" | "concentration_check" | "other";
  title: string;
  detail: string | null;
  triggerCondition: string | null;
  dueDate: string | null;
  status: "open" | "done" | "dismissed";
  createdAt: string;
  updatedAt: string;
};

export type PortfolioDbPosition = {
  id: string;
  accountId: string;
  instrumentId: string;
  assetType: string | null;
  identifier: string | null;
  name: string | null;
  accountName: string | null;
  accountType: PortfolioAccountType | null;
  institutionName: string | null;
  quantity: number;
  unitCost: number | null;
  quotedPrice: number | null;
  quoteUnit: number;
  costBasis: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  distributionMethod: string | null;
};

export type PortfolioDbCounts = {
  portfolio: number;
  snapshots: number;
  accounts: number;
  instruments: number;
  positions: number;
  reviews: number;
  reviewItems: number;
};

export type PortfolioData = {
  authState: "authenticated" | "required";
  portfolio: {
    id: string | null;
    name: string | null;
    baseCurrency: string;
  };
  snapshots: PortfolioSnapshot[];
  currentSnapshot: PortfolioSnapshot | null;
  dbPositionSnapshot: PortfolioSnapshot | null;
  positions: PortfolioPosition[];
  dbPositions: PortfolioDbPosition[];
  review: PortfolioReview | null;
  activePolicy: PortfolioPolicy | null;
  policyHistory: PortfolioPolicy[];
  latestReflection: PortfolioReflection | null;
  reflections: PortfolioReflection[];
  recommendations: PortfolioRecommendation[];
  actions: PortfolioAction[];
  dbCounts: PortfolioDbCounts;
  source: "server" | "empty";
};
