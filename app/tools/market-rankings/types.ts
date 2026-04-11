export type MarketRankingType = "market-cap" | "dividend-yield";
export type MarketRankingMarket = "prime" | "standard" | "growth";

export type MarketRankingManifest = {
  latest: string;
  months: string[];
  generatedAt: string;
};

export type MarketRankingRecord = {
  rank: number;
  code: string;
  name: string;
  industry: string;
  marketCapOkuYen: number | null;
  price: number | null;
  priceTime: string | null;
  changeAmount: number | null;
  changeRate: number | null;
  dividendYieldPct: number | null;
};

export type MarketRankingMarketData = {
  date: string;
  records: MarketRankingRecord[];
};

export type MarketRankingMonthData = {
  month: string;
  generatedAt: string;
  markets: Partial<Record<MarketRankingMarket, MarketRankingMarketData>>;
};

export type MarketRankingPageData = {
  rankingType: MarketRankingType;
  manifest: MarketRankingManifest | null;
  selectedMonth: string;
  initialMonthData: MarketRankingMonthData | null;
  monthDataFailed: boolean;
};
