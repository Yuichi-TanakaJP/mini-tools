export type EconCalendarEvent = {
  date: string;
  time: string;
  country: string;
  country_tag: string;
  indicator: string;
  impact: number;
  previous: string | null;
  forecast: string | null;
  result: string | null;
};

export type EconCalendarWeeklyResponse = {
  week: { from: string; to: string };
  published_at: string;
  events: EconCalendarEvent[];
};

export type EconCalendarMeta = {
  week: { from: string; to: string };
  published_at: string;
  event_count: number;
  changed_count: number | null;
};

export type EconCalendarPageData = {
  weekly: EconCalendarWeeklyResponse | null;
  meta: EconCalendarMeta | null;
};
