export type EdinetManifest = {
  dates: string[];
};

export type EdinetDocItem = {
  doc_id: string;
  submit_datetime: string;
  edinet_code: string;
  sec_code: string | null;
  filer_name: string;
  doc_type_code: string;
  doc_description: string;
  has_xbrl: boolean;
  has_pdf: boolean;
  has_csv: boolean;
};

export type EdinetDocumentListResponse = {
  as_of_date: string;
  total_count: number;
  items: EdinetDocItem[];
};
