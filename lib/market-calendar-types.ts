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
