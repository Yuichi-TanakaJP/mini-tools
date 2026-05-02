export type EconCalendarEvent = {
  time: string | null;
  area: string | null;
  country: string | null;
  country_tag: string | null;
  indicator: string;
  indicator_key: string | null;
  display: string | null;
  category: string | null;
  impact: number | null;
  frequency: string | null;
  previous: string | null;
  forecast: string | null;
  result: string | null;
};

export type EconCalendarDay = {
  date: string;
  weekday_jp: string;
  events: EconCalendarEvent[];
};

export type EconCalendarWeeklyResponse = {
  as_of_date: string;
  source: string;
  week_start: string;
  week_end: string;
  calendar: EconCalendarDay[];
};

export type EconCalendarMeta = {
  published_at: string;
  source: string;
  week_start: string;
  week_end: string;
  event_count: number;
  matched_count: number | null;
  unmatched_count: number | null;
  actuals_filled: number | null;
  diff: {
    skipped: boolean;
    actuals_updated_count: number | null;
  } | null;
};

export type EconCalendarManifest = {
  updated_at: string;
  weeks: string[]; // "YYYY-MM-DD" (week_start) 降順
};

export type EconCalendarPageData = {
  weekly: EconCalendarWeeklyResponse | null;
  meta: EconCalendarMeta | null;
  manifest: EconCalendarManifest | null;
};
