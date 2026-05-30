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

export type InvestorFlowPageData = {
  manifest: InvestorFlowManifest | null;
  payload: InvestorFlowPayload | null;
  selectedWeek: InvestorFlowWeekRef | null;
  loadFailed: boolean;
};
