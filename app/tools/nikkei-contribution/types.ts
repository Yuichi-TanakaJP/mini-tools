export type NikkeiContributionRecord = {
  code: string;
  sector: string;
  name: string;
  price: number;
  minashi: number;
  weight_pct: number;
  chg_pct: number;
  chg: number;
  contribution: number;
  size_value: number;
  color_value: number;
};

export type NikkeiContributionRankItem = {
  rank: number;
  code: string;
  name: string;
  contribution: number;
  chg_pct: number;
  weight_pct: number;
};

export type NikkeiContributionSummary = {
  total_contribution: number;
  advancers: number;
  decliners: number;
  unchanged: number;
};

export type NikkeiContributionDayData = {
  date: string;
  index: "nikkei225";
  generated_at?: string;
  source?: string;
  market_status?: string;
  summary: NikkeiContributionSummary;
  top_positive: NikkeiContributionRankItem[];
  top_negative: NikkeiContributionRankItem[];
  records: NikkeiContributionRecord[];
};

export type NikkeiContributionManifest = {
  dates: string[];
  latest_date: string | null;
};

export type NikkeiContributionPageData = {
  manifest: NikkeiContributionManifest;
  initialDayData: NikkeiContributionDayData | null;
};
