import { describe, expect, it } from "vitest";
import { filterFullTdnetByHoldings } from "./holdings-filter";
import type { TdnetDisclosureItem } from "./types";

function source(code: string, title: string): TdnetDisclosureItem {
  return {
    disclosure_date: "2026-10-08",
    disclosure_time: "15:30",
    security_code: code,
    company_name: "テスト株式会社",
    title,
    disclosure_category: "その他",
    pdf_url: "https://www.release.tdnet.info/inbs/140120261008548027.pdf",
    xbrl_url: "",
    html_url: "",
    has_pdf: true,
    has_xbrl: false,
    has_html: false,
    is_financial_related: false,
    is_earnings_release: false,
    is_correction: false,
    fetched_at: "2026-10-08T15:00:00Z",
  };
}

describe("TDNET full disclosures for current holdings", () => {
  it("retains all held-issuer documents including titles outside Router V1", () => {
    const rows = [
      source("47180", "主要株主の異動に関するお知らせ"),
      source("75130", "決算短信"),
      source("75130", "決算補足説明資料"),
      source("75130", "剰余金の配当（増配）に関するお知らせ"),
      source("99990", "その他の会社の開示"),
    ];
    const result = filterFullTdnetByHoldings(rows, new Set(["4718", "7513"]));
    expect(result).toHaveLength(4);
    expect(result.map((item) => item.title)).toContain("主要株主の異動に関するお知らせ");
    expect(result.map((item) => item.title)).toContain("決算補足説明資料");
    expect(result.map((item) => item.title)).toContain("剰余金の配当（増配）に関するお知らせ");
  });

  it("does not accidentally strip a real 4-digit ticker ending in zero", () => {
    const rows = [source("12300", "自己株式消却"), source("12340", "非保有会社")];
    expect(filterFullTdnetByHoldings(rows, new Set(["1230"]))).toEqual([rows[0]]);
  });

  it("supports alphanumeric JPX codes and excludes watchlist-only companies", () => {
    const rows = [source("167A0", "決算短信"), source("44440", "ウォッチだけの会社")];
    expect(filterFullTdnetByHoldings(rows, new Set(["167A"]))).toEqual([rows[0]]);
  });

  it("never guesses identity from a matching company name", () => {
    const row = source("99990", "重要なお知らせ");
    expect(filterFullTdnetByHoldings([row], new Set(["4718"]))).toEqual([]);
  });
});
