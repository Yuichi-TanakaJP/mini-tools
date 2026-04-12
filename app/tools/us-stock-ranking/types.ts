export type UsRankingType = "値上り率" | "値下り率" | "売買代金";

export type UsRankingRecord = {
  exchange: string;
  ranking: UsRankingType;
  rank: number;
  ticker: string;
  listingExchange: string;
  handlingFlag: string;
  name: string;
  nameEn: string;
  price: number;
  time: string;
  change: number;
  changeRate: number;
  volume: number;
  tradedValue: number;
  per: number | null;
  pbr: number | null;
};

export type UsRankingDayData = {
  date: string;
  records: UsRankingRecord[];
};

export type UsRankingManifest = {
  dates: string[];
  latest: string;
};

export type UsRankingPageData = {
  manifest: UsRankingManifest | null;
  initialDayData: UsRankingDayData | null;
};
