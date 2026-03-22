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
