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

export type EarningsCalendarPageData = {
  manifest: EarningsCalendarManifest;
  monthData: Record<string, EarningsCalendarResponse>;
  holidays: JpxMarketClosedResponse;
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
