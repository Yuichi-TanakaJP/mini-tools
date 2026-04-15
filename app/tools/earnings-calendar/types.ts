import type { JpxMarketClosedResponse } from "@/lib/market-calendar-types";

export type EarningsCalendarItem = {
  event_id?: string;
  time: string;
  code: string;
  name: string;
  market: string;
  announcement_type: string;
  publish_status: string;
  progress_status: string;
};

export type EarningsCalendarDetailStatus = "present" | "empty" | "missing";

export type EarningsCalendarDay = {
  date: string;
  count: number;
  detail_status: EarningsCalendarDetailStatus;
  items: EarningsCalendarItem[];
};

export type EarningsCalendarResponse = {
  as_of_date: string;
  calendar: EarningsCalendarDay[];
};

export type OverseasEarningsCalendarItem = {
  event_id?: string;
  local_time?: string;
  ticker?: string;
  stock_name?: string;
  exchange_code?: string;
  fiscal_term_name?: string;
  fiscal_term?: string;
  sch_flg?: string;
  country_code?: string;
};

export type OverseasEarningsCalendarDay = {
  date: string;
  count: number;
  detail_status: EarningsCalendarDetailStatus;
  items: OverseasEarningsCalendarItem[];
};

export type OverseasEarningsCalendarResponse = {
  as_of_date: string;
  calendar: OverseasEarningsCalendarDay[];
};

export type EarningsCalendarManifestMonth = {
  id: string;
  year: number;
  month: number;
  path: string;
  partial: boolean;
  bucket: "past" | "current" | "future";
};

export type EarningsCalendarManifest = {
  as_of_date: string;
  current_window: {
    from: string;
    to: string;
  };
  months: EarningsCalendarManifestMonth[];
};

export type EarningsCalendarMarket = "domestic" | "overseas";

export type EarningsCalendarMarketData = {
  manifest: EarningsCalendarManifest | null;
  monthData: Record<string, EarningsCalendarResponse>;
  latest: EarningsCalendarResponse | null;
  holidays: JpxMarketClosedResponse | null;
};

export type EarningsCalendarPageData = {
  domestic: EarningsCalendarMarketData;
  overseas: EarningsCalendarMarketData;
};

export type { JpxMarketClosedDay, JpxMarketClosedResponse } from "@/lib/market-calendar-types";
