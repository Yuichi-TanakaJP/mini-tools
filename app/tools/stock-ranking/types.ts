export type RankingMarket = "プライム" | "スタンダード" | "グロース";
export type RankingType = "値上がり率" | "値下がり率" | "売買高";

export type RankingRecord = {
  market: RankingMarket;
  ranking: RankingType;
  rank: number;
  name: string;
  code: string;
  marketLabel: string;
  industry: string;
  price: number;
  time: string;
  change: number;
  changeRate: number;
  volume: number;
  value: number;
};

export type RankingDayData = {
  date: string;
  records: RankingRecord[];
};

export type RankingManifest = {
  dates: string[];
  latest: string;
};

export type JpxMarketClosedDay = {
  date: string;
  label: string;
  market_closed: boolean;
};

export type JpxMarketClosedResponse = {
  as_of_date: string;
  from: string;
  to: string;
  days: JpxMarketClosedDay[];
};

export type RankingPageData = {
  manifest: RankingManifest;
  initialDayData: RankingDayData | null;
};
