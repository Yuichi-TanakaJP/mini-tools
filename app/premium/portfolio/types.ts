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
  status: "ready" | "superseded" | "failed";
  sourceType: string;
  importedAt: string;
};

export type PortfolioPosition = {
  id: string;
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
  title: string;
  status: "draft" | "finalized";
  asOf: string;
  newCapitalAmount: number | null;
  summary: string | null;
  allocationPolicy: string | null;
  updatedAt: string;
  items: PortfolioReviewItem[];
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
  positions: PortfolioPosition[];
  review: PortfolioReview | null;
  source: "server" | "empty";
};
