export type MonthlyYutaiCandidate = {
  code: string;
  company_name: string;
  month: number;
  minimum_investment_text: string;
  benefit_category_tags: string[];
  minkabu_yutai_url: string;
  official_benefit_url?: string;
  official_link_status?: string;
};

export type MonthlyYutaiMonthManifest = {
  id: string;
  year: number;
  month: number;
  path: string;
  total_count?: number;
  updated_at?: string;
};

export type MonthlyYutaiManifest = {
  as_of_date: string;
  months: MonthlyYutaiMonthManifest[];
};

export type MonthlyYutaiPageData = {
  manifest: MonthlyYutaiManifest | null;
  selectedMonthId: string;
  items: MonthlyYutaiCandidate[];
};
