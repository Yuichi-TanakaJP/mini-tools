import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyForeignIncome, foreignRowAmount, loadForeignIncome, selectForeignIncome, summarizeForeignIncome, type ForeignIncomeRow } from "./foreign-income";
import { emptyExternalAssets } from "./external-assets";
import type { PortfolioExternalAssetPosition, PortfolioPosition, PortfolioSnapshot } from "./types";
import PortfolioForeignIncome from "./PortfolioForeignIncome";
import PortfolioIncomeSummary, { PortfolioIncomeNotes } from "./PortfolioIncomeSummary";
import { emptyDomesticDividendProjection } from "./dividend-income";

const snapshot: PortfolioSnapshot = { id: "s", asOf: "2026-10-31T00:00:00Z", status: "ready", portfolioScope: "official", sourceType: "synthetic", importedAt: "2026-10-31", sourceLabel: null };
function row(overrides: Partial<ForeignIncomeRow> = {}): ForeignIncomeRow {
  return { user_id: "u", portfolio_id: "p", snapshot_id: "s", snapshot_as_of: snapshot.asOf, portfolio_scope: "official", position_id: "pos", account_id: "a", instrument_id: "i", ticker: "SYNTH", instrument_name: "合成ETF", asset_type: "equity_fund", native_currency: "USD", quantity: "10", metric_key: "ttm_distribution_per_unit", observation_as_of: "2026-10-30T00:00:00Z", period_start: "2025-11-01", period_end: "2026-10-30", source_title: "合成公式出典", source_url: "https://example.com/income", source_as_of: "2026-10-30T00:00:00Z", value_origin: "calculated", formula_version: "ttm_test_v1", annual_income_per_unit: "2", native_annual_income: "20", fx_rate: "150", fx_as_of: "2026-10-30T00:00:00Z", fx_source: "合成為替", annual_income_jpy: "3000", income_basis: "trailing_12_months", status: "available", exclusion_reason: null, ...overrides };
}
const position: PortfolioPosition = { id: "pos", instrumentId: "i", accountId: "a", assetType: "equity_fund", nativeCurrency: "USD", identifier: "SYNTH", name: "合成ETF", quantity: 10, quantityKnown: true, accountName: "合成口座", accountType: "taxable", institutionName: "合成", unitCost: null, quotedPrice: null, quoteUnit: 1, marketValue: 15000, costBasis: null, unrealizedPnl: null, distributionMethod: null };
const projection = (rows: ForeignIncomeRow[]) => ({ status: "loaded" as const, rows, expectedPositions: rows.length });
function db(rows: ForeignIncomeRow[], code?: string, log: string[] = []) {
  let start = 0, end = rows.length;
  const query = { select: () => query, eq: (column: string, value: string) => { log.push(`${column}=${value}`); return query; }, in: (column: string, values: string[]) => { log.push(`${column}=${values.join(",")}`); return query; }, order: () => query, range: (from: number, to: number) => { start = from; end = to + 1; log.push(`range=${from}`); return query; }, returns: async () => ({ data: rows.slice(start, end), error: code ? { code } : null }) };
  return { from: () => query } as unknown as SupabaseClient;
}

describe("外国株・ETFの参考インカム", () => {
  it("SQLの円換算値をそのまま集計し、無配方針による既知0を未確認と区別する", () => {
    const zero = row({ position_id: "zero", income_basis: "no_dividend_policy", asset_type: "foreign_stock", annual_income_per_unit: "0", native_annual_income: "0", annual_income_jpy: "0" });
    expect(summarizeForeignIncome(projection([row(), zero]))).toEqual({ partial: 3000, complete: 3000, available: 2, missing: 0 });
    expect(summarizeForeignIncome(projection([zero])).complete).toBe(0);
  });
  it("一部未確認は小計だけを返し、全体確定額を作らない", () => {
    expect(summarizeForeignIncome(projection([row(), row({ position_id: "missing", status: "unavailable", annual_income_jpy: null, exclusion_reason: "fx_missing" })]))).toEqual({ partial: 3000, complete: null, available: 1, missing: 1 });
    expect(summarizeForeignIncome(projection([row({ annual_income_jpy: null })])).partial).toBeNull();
  });
  it.each([{ annual_income_jpy: "NaN" }, { quantity: null }, { fx_rate: "0" }, { source_url: "javascript:alert(1)" }, { source_as_of: "2026-11-01" }, { fx_as_of: "invalid" }, { observation_as_of: "2026-11-01" }, { native_currency: "JPY" }, { asset_type: "mmf" }, { income_basis: null }])("不正/未来/対象外の金額を利用しない %j", (change) => {
    expect(foreignRowAmount(row(change as Partial<ForeignIncomeRow>))).toBeNull();
  });
  it("配当表に原通貨・為替日・出典・過去実績と無配方針の違いを表示する", () => {
    const html = renderToStaticMarkup(createElement(PortfolioForeignIncome, { projection: projection([row(), row({ position_id: "zero", asset_type: "foreign_stock", income_basis: "no_dividend_policy", annual_income_jpy: "0", native_annual_income: "0" })]), view: "list", scopeLabel: "全体" }));
    for (const text of ["20 USD", "3,000", "過去12か月分配実績", "公表無配方針に基づく見込み0", "2026/10/30", "合成公式出典", "横スクロール"]) expect(html).toContain(text);
    expect(html).toContain("MMF・税引後額・実際の受取額は含みません");
  });
  it("グラフの既知0は表示し、未確認に棒を作らない", () => {
    const html = renderToStaticMarkup(createElement(PortfolioForeignIncome, { projection: projection([row({ annual_income_jpy: "0", native_annual_income: "0" }), row({ position_id: "missing", status: "unavailable", exclusion_reason: "fx_missing" })]), view: "graph", scopeLabel: "全体" }));
    expect(html.match(/role="img"/g)).toHaveLength(1); expect(html).toContain("為替情報が未確認");
  });
  it.each(["error", "missing", "incomplete"] as const)("%sを0円に置き換えない", (status) => {
    expect(summarizeForeignIncome(emptyForeignIncome(status, 2)).partial).toBeNull();
    const html = renderToStaticMarkup(createElement(PortfolioForeignIncome, { projection: emptyForeignIncome(status, 2), view: "graph", scopeLabel: "全体" }));
    expect(html).not.toContain("￥0"); expect(html).not.toContain('role="img"');
  });
  it("カードの金額は国内と海外の総計1つにし、内訳・対象外条件を外へ出す", () => {
    const domestic = { ...emptyDomesticDividendProjection("ready", "2026-10-31"), sourceIntegrity: true,
      expectedStocks: 1, projectedAnnualGross: 1000,
      positions: [{ instrumentId: "jp", ticker: "SYNJP", name: "合成国内", quantity: 10, actualDps: null, forecastDps: 100,
        rawForecastDps: 100, cashProjectionStatus: "resolved", forecastAsOf: "2026-10-01", annualGross: 1000,
        priorRunRateGross: null, rateEffectGross: null, changeType: "not_comparable" }] } as import("./dividend-income").DomesticDividendProjection;
    const props = { projection: domestic, foreignIncome: projection([row()]) };
    const html = renderToStaticMarkup(createElement(PortfolioIncomeSummary, props));
    expect(html).toContain("年間配当見込み");
    expect(html.match(/summaryValue/g)).toHaveLength(1);
    expect(html).toContain("4,000");
    expect(html).not.toContain("1,000"); expect(html).not.toContain("3,000");
    expect(html).not.toContain("小計"); expect(html).not.toContain("税引前");
    const notes = renderToStaticMarkup(createElement(PortfolioIncomeNotes, props));
    expect(notes).toContain("1,000"); expect(notes).toContain("3,000");
    expect(notes).toContain("過去12か月実績"); expect(notes).toContain("MMFは対象外");
    const unknown = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { ...props, foreignIncome: emptyForeignIncome("error", 1) }));
    expect(unknown).toContain(">—</span>"); expect(unknown).not.toContain("1,000");
    const onlyForeign = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: emptyDomesticDividendProjection("no_domestic_stocks"), foreignIncome: projection([row()]) }));
    expect(onlyForeign).toContain("3,000");
  });
  it("集計対象なしは—、無配を確認した対象だけの総計は0円と区別する", () => {
    const domestic = emptyDomesticDividendProjection("no_domestic_stocks");
    const none = { projection: domestic, foreignIncome: emptyForeignIncome("empty") };
    expect(renderToStaticMarkup(createElement(PortfolioIncomeSummary, none))).toContain(">—</span>");
    expect(renderToStaticMarkup(createElement(PortfolioIncomeNotes, none))).toContain("対象となる株式・ETFはありません");
    const zero = projection([row({ asset_type: "foreign_stock", income_basis: "no_dividend_policy", annual_income_per_unit: "0", native_annual_income: "0", annual_income_jpy: "0" })]);
    expect(renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: domestic, foreignIncome: zero }))).toContain(">￥0</span>");
  });
  it("position単位で口座を選択し、同一商品を口座全体へ拡大しない", () => {
    const source = projection([row(), row({ position_id: "other-account", account_id: "b", annual_income_jpy: "6000" })]);
    expect(selectForeignIncome(source, [position], emptyExternalAssets(), "account_type", "all", ["bucket:taxable"])?.rows).toHaveLength(1);
  });
  it("外部参照は分類を捏造せず未分類にし、個別株scopeにETFを混ぜない", () => {
    const externalPosition = { ...position, id: "ext", assetType: "equity_fund", nativeCurrency: "USD" } as unknown as PortfolioExternalAssetPosition;
    const external = { ...emptyExternalAssets(), positions: [externalPosition] };
    const source = projection([row({ position_id: "ext", portfolio_scope: "external_reference" })]);
    expect(selectForeignIncome(source, [], external, "sector_33", "all", ["bucket:unclassified"])?.rows).toHaveLength(1);
    expect(selectForeignIncome(source, [], external, "sector_33", "all", ["bucket:医薬品"])?.rows).toHaveLength(0);
    expect(selectForeignIncome(source, [], external, "asset_type", "equity", null)?.rows).toHaveLength(0);
  });
});

describe("foreign income reader", () => {
  it("置換済み外部snapshotを現在の取得失敗とせず、公式保有の参考配当を表示する", async () => {
    const external = { ...emptyExternalAssets(), status: "superseded" as const,
      snapshot: { ...snapshot, id: "retired", portfolioScope: "external_reference" as const, status: "superseded" as const },
      positions: [{ ...position, id: "retired-position", nativeCurrency: "USD" } as unknown as PortfolioExternalAssetPosition] };
    const log: string[] = [];
    const result = await loadForeignIncome(db([row()], undefined, log), "u", "p", snapshot, [position], external);
    expect(result.status).toBe("loaded");
    expect(summarizeForeignIncome(result).complete).toBe(3000);
    expect(log).toContain("snapshot_id=s");
    expect(log.join(" ")).not.toContain("retired");
    const html = renderToStaticMarkup(createElement(PortfolioIncomeSummary, { projection: emptyDomesticDividendProjection("no_domestic_stocks"), foreignIncome: result }));
    expect(html).toContain("3,000");
  });
  it("置換済み外部snapshotしかない場合は保有未取得のままにする", async () => {
    const external = { ...emptyExternalAssets(), status: "superseded" as const,
      snapshot: { ...snapshot, id: "retired", portfolioScope: "external_reference" as const, status: "superseded" as const } };
    const result = await loadForeignIncome(db([]), "u", "p", null, [], external);
    expect(result.status).toBe("no_snapshot");
    expect(summarizeForeignIncome(result).partial).toBeNull();
  });
  it.each(["error", "loading"] as const)("現在の外部snapshotの%sは保留し、0で代用しない", async (status) => {
    const result = await loadForeignIncome(db([row()]), "u", "p", snapshot, [position], { ...emptyExternalAssets(), status });
    expect(result.status).toBe("error");
    expect(summarizeForeignIncome(result).partial).toBeNull();
  });

  it("本人・Portfolio・現在snapshotで限定し、行数とposition identityを照合する", async () => {
    const log: string[] = [];
    expect((await loadForeignIncome(db([row()], undefined, log), "u", "p", snapshot, [position], emptyExternalAssets())).status).toBe("loaded");
    expect(log).toEqual(["user_id=u", "portfolio_id=p", "snapshot_id=s", "range=0"]);
  });
  it.each([[], [row(), row()], [row({ user_id: "other" })], [row({ snapshot_id: "old" })], [row({ position_id: "not-held" })], [row({ portfolio_scope: "external_reference" })]].map((rows) => ({ rows })))("欠損/重複/別owner/旧snapshot/別positionはincomplete", async ({ rows }) => {
    expect((await loadForeignIncome(db(rows), "u", "p", snapshot, [position], emptyExternalAssets())).status).toBe("incomplete");
  });
  it("原通貨が不明な外国株も対象件数へ残し、SQLの未確認理由を表示する", async () => {
    const held = { ...position, assetType: "foreign_stock", nativeCurrency: null };
    const result = await loadForeignIncome(db([row({ asset_type: "foreign_stock", native_currency: null, status: "unavailable", exclusion_reason: "currency_missing", annual_income_jpy: null })]), "u", "p", snapshot, [held], emptyExternalAssets());
    expect(result.status).toBe("loaded"); expect(summarizeForeignIncome(result).missing).toBe(1);
  });
  it("原通貨不明のETFも欠落扱いにせずSQLのcurrency_missingとして残す", async () => {
    const held = { ...position, nativeCurrency: null };
    const result = await loadForeignIncome(db([row({ native_currency: null, status: "unavailable", exclusion_reason: "currency_missing", annual_income_jpy: null })]), "u", "p", snapshot, [held], emptyExternalAssets());
    expect(result.status).toBe("loaded"); expect(summarizeForeignIncome(result).missing).toBe(1);
    const html = renderToStaticMarkup(createElement(PortfolioForeignIncome, { projection: projection([row({ status: "unavailable", exclusion_reason: "share_basis_unverified", annual_income_jpy: null })]), view: "list", scopeLabel: "全体" }));
    expect(html).toContain("保有基準日の株数基準が未確認");
  });
  it("view未適用だけmissing、権限/通信失敗はerrorとして保持する", async () => {
    expect((await loadForeignIncome(db([], "42P01"), "u", "p", snapshot, [position], emptyExternalAssets())).status).toBe("missing");
    expect((await loadForeignIncome(db([], "42501"), "u", "p", snapshot, [position], emptyExternalAssets())).status).toBe("error");
    expect((await loadForeignIncome(db([], "NETWORK"), "u", "p", snapshot, [position], emptyExternalAssets())).status).toBe("error");
  });
  it("複数ページを読み、201件目まで揃って初めてloadedにする", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => row({ position_id: `pos${i}` }));
    const positions = rows.map((r) => ({ ...position, id: r.position_id }));
    const log: string[] = [];
    expect((await loadForeignIncome(db(rows, undefined, log), "u", "p", snapshot, positions, emptyExternalAssets())).rows).toHaveLength(201);
    expect(log).toContain("range=200");
  });
  it("外部参照の取得失敗やowner未指定を成功0にしない", async () => {
    expect((await loadForeignIncome(db([]), "u", "p", snapshot, [], { ...emptyExternalAssets(), status: "error" })).status).toBe("error");
    expect((await loadForeignIncome(db([row()]), undefined, "p", snapshot, [position], emptyExternalAssets())).status).toBe("error");
  });
});
