export type Topix33SectorRecord = {
  sector_code: string;
  sector_name: string;
  chg_pct: number;
  chg: number;
};

export type Topix33RankItem = {
  rank: number;
  sector_code: string;
  sector_name: string;
  chg_pct: number;
  chg: number;
};

export type Topix33Summary = {
  advancers: number;
  decliners: number;
  unchanged: number;
};

export type Topix33DayData = {
  date: string;
  index: "topix33";
  generated_at?: string;
  source?: string;
  market_status?: string;
  summary: Topix33Summary;
  top_positive: Topix33RankItem[];
  top_negative: Topix33RankItem[];
  sectors: Topix33SectorRecord[];
};

export type Topix33Manifest = {
  dates: string[];
  latest_date: string | null;
};

export type JpxMarketClosedDay = {
  date: string;
  market_closed: boolean;
  label: string;
};

export type JpxMarketClosedResponse = {
  as_of_date: string;
  from: string;
  to: string;
  days: JpxMarketClosedDay[];
};

export type Topix33PageData = {
  manifest: Topix33Manifest;
  initialDayData: Topix33DayData | null;
  holidays: JpxMarketClosedResponse | null;
};
