export type TdnetDisclosureItem = {
  disclosure_date: string;
  disclosure_time: string;
  security_code: string;
  company_name: string;
  title: string;
  disclosure_category: string;
  pdf_url: string;
  xbrl_url: string;
  html_url: string;
  has_pdf: boolean;
  has_xbrl: boolean;
  has_html: boolean;
  is_financial_related: boolean;
  is_earnings_release: boolean;
  is_correction: boolean;
  fetched_at: string;
};

export type TdnetDisclosureListResponse = {
  status?: string;
  target_date: string;
  source: string;
  total_count: number;
  items: TdnetDisclosureItem[];
  range_days?: number;
  loaded_dates?: string[];
};
