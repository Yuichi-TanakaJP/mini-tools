export type MonthlyYutaiCandidate = {
  code: string;
  company_name: string;
  month: number;
  benefit_summary: string;
  minimum_investment_text: string;
  minimum_investment_yen: number | null;
  benefit_category_tags: string[];
  minkabu_yutai_url: string;
  has_official_link: boolean;
  official_benefit_url: string | null;
  official_link_status: "found" | "missing" | "not_checked";
  source: string;
  fetched_at: string;
};

export type MonthlyYutaiMonthManifest = {
  year: number;
  month: number;
  path: string;
  count: number;
};

export type MonthlyYutaiManifest = {
  version: number;
  generated_at: string;
  source: string;
  latest_month: string;
  latest_path: string;
  months: MonthlyYutaiMonthManifest[];
};

export type MonthlyYutaiMonthData = {
  year: number;
  month: number;
  generated_at: string;
  source: string;
  records: MonthlyYutaiCandidate[];
};

export type MonthlyYutaiPageData = {
  manifest: MonthlyYutaiManifest | null;
  selectedMonthId: string;
  generatedAt: string | null;
  source: string | null;
  items: MonthlyYutaiCandidate[];
};
