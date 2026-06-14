export type DisclosureEventType =
  | "yutai_new"
  | "yutai_expand"
  | "yutai_change"
  | "yutai_end"
  | "yutai_review"
  | "dividend_increase"
  | "dividend_decrease"
  | "dividend_change"
  | "performance_revision"
  | "share_buyback"
  | "ma_reorganization"
  | "governance"
  | "correction";

export type DisclosureEventItem = {
  event_id: string;
  source: "tdnet";
  event_type: DisclosureEventType;
  audience: "all" | "personal";
  priority: "high" | "medium" | "low";
  needs_review: boolean;
  disclosure_date: string;
  disclosure_time: string;
  security_code: string;
  company_name: string;
  title: string;
  disclosure_category: string;
  source_url: string;
  pdf_url: string;
  html_url: string;
  xbrl_url: string;
};

export type DisclosureEventsResponse = {
  schema_version: "disclosure-events-v1";
  target_date: string;
  generated_at: string;
  total_count: number;
  items: DisclosureEventItem[];
};

export type DisclosureEventsManifest = {
  schema_version: "disclosure-events-manifest-v1";
  generated_at: string;
  latest: string;
  dates: string[];
};

export type DisclosureEventsPageData = {
  latestDate: string;
  referenceDate: string;
  loadedDates: string[];
  items: DisclosureEventItem[];
};
