export type InvestorFlowRecord = {
  row_index: number;
  category: string;
  sell_thousand_yen: number;
  share_sell_pct: number | null;
  buy_thousand_yen: number;
  share_buy_pct: number | null;
  diff_thousand_yen: number;
  sell_yen: number;
  buy_yen: number;
  diff_yen: number;
};

export type InvestorFlowPayload = {
  data_source: string;
  source_url: string;
  source_file: string;
  week_label_raw: string;
  start_date: string;
  end_date: string;
  market_scope: string;
  unit: string;
  generated_at_jst: string;
  records: InvestorFlowRecord[];
};

export type InvestorFlowWeekRef = {
  start_date: string;
  end_date: string;
  path: string;
};

export type InvestorFlowManifest = {
  data_source: string;
  latest: InvestorFlowWeekRef;
  weeks: InvestorFlowWeekRef[];
  generated_at_jst: string;
};

export type InvestorFlowAnalysisManifest = {
  data_source: string;
  schema_version: string;
  latest: InvestorFlowWeekRef;
  weeks: InvestorFlowWeekRef[];
  generated_at_jst: string;
};

export type InvestorFlowAnalysisCategoryAmount = {
  category: string;
  diff_yen: number;
};

export type InvestorFlowCompositionItem = {
  group: "total" | "commission" | string;
  denominator_category: string;
  category: string;
  parent_category: string;
  amount_yen: number;
  share_pct: number | null;
  level: number;
  is_top_level: boolean;
};

export type InvestorFlowNetRankingItem = {
  category: string;
  buy_yen: number | null;
  sell_yen: number | null;
  diff_yen: number;
  direction: "net_buy" | "net_sell" | "flat" | "unknown" | string;
  previous_diff_yen: number | null;
  diff_change_yen: number | null;
  rank_by_abs_diff: number;
};

export type InvestorFlowReversalItem = {
  category: string;
  from_direction: string;
  to_direction: string;
  previous_diff_yen: number;
  current_diff_yen: number;
  change_yen: number;
  strength: "large" | "medium" | "small" | string;
};

export type InvestorFlowStreakItem = {
  category: string;
  direction: string;
  weeks: number;
  current_diff_yen: number | null;
  started_start_date: string | null;
  started_end_date: string | null;
};

export type InvestorFlowMajorFlowItem = {
  category: string;
  buy_yen: number | null;
  sell_yen: number | null;
  diff_yen: number | null;
  direction: string;
  previous_diff_yen: number | null;
  diff_change_yen: number | null;
};

export type InvestorFlowAnalysisPayload = {
  schema_version: string;
  data_source: string;
  analysis_scope: string;
  start_date: string;
  end_date: string;
  previous_start_date: string | null;
  previous_end_date: string | null;
  generated_at_jst: string;
  source_snapshot_path: string;
  lookback_weeks: number;
  summary: {
    largest_net_buy: InvestorFlowAnalysisCategoryAmount | null;
    largest_net_sell: InvestorFlowAnalysisCategoryAmount | null;
  };
  buy_composition: InvestorFlowCompositionItem[];
  sell_composition: InvestorFlowCompositionItem[];
  net_ranking: InvestorFlowNetRankingItem[];
  reversals: InvestorFlowReversalItem[];
  streaks: InvestorFlowStreakItem[];
  major_flows: InvestorFlowMajorFlowItem[];
};

export type InvestorFlowPageData = {
  manifest: InvestorFlowManifest | null;
  payload: InvestorFlowPayload | null;
  analysisManifest: InvestorFlowAnalysisManifest | null;
  analysis: InvestorFlowAnalysisPayload | null;
  selectedWeek: InvestorFlowWeekRef | null;
  loadFailed: boolean;
  analysisLoadFailed: boolean;
};
