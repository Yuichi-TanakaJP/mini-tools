import { getPositionAllocationBucket, type PortfolioAllocationDimension, type PortfolioAllocationScope } from "./allocation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioExternalAssets, PortfolioPosition, PortfolioSnapshot } from "./types";

export type ForeignIncomeRow = {
  user_id: string; portfolio_id: string; snapshot_id: string; snapshot_as_of: string;
  portfolio_scope: "official" | "external_reference"; position_id: string; account_id: string;
  instrument_id: string; ticker: string | null; instrument_name: string | null; asset_type: string;
  native_currency: string | null; quantity: number | string | null; metric_key: string | null;
  observation_as_of: string | null; period_start: string | null; period_end: string | null;
  source_title: string | null; source_url: string | null; source_as_of: string | null;
  value_origin: string | null; formula_version: string | null;
  annual_income_per_unit: number | string | null; native_annual_income: number | string | null;
  fx_rate: number | string | null; fx_as_of: string | null; fx_source: string | null;
  annual_income_jpy: number | string | null;
  income_basis: "no_dividend_policy" | "trailing_12_months" | null;
  status: "available" | "unavailable"; exclusion_reason: string | null;
};
export type ForeignIncomeProjection = {
  status: "loaded" | "empty" | "no_snapshot" | "missing" | "error" | "incomplete";
  rows: ForeignIncomeRow[]; expectedPositions: number;
};
export const emptyForeignIncome = (status: ForeignIncomeProjection["status"] = "no_snapshot", expectedPositions = 0): ForeignIncomeProjection => ({ status, rows: [], expectedPositions });
export const foreignAssetTypes = new Set(["foreign_stock", "equity_fund", "bond_fund"]);
export function incomeNumber(value: number | string | null) {
  if (value === null || (typeof value === "string" && !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}
function validDate(value: string | null): value is string { return !!value && Number.isFinite(Date.parse(value)); }
/** Trust only a complete DB-validated amount; do not calculate a replacement. */
export function foreignRowAmount(row: ForeignIncomeRow): number | null {
  if (row.status !== "available" || !["no_dividend_policy", "trailing_12_months"].includes(row.income_basis ?? "") || row.exclusion_reason) return null;
  if (!row.native_currency || row.native_currency === "JPY" || !foreignAssetTypes.has(row.asset_type)) return null;
  if (!validDate(row.snapshot_as_of) || !validDate(row.observation_as_of) || !validDate(row.source_as_of) || !validDate(row.fx_as_of)) return null;
  if ([row.observation_as_of, row.source_as_of, row.fx_as_of].some((date) => Date.parse(date!) > Date.parse(row.snapshot_as_of))) return null;
  if (!row.fx_source || !row.source_title || !row.source_url || !/^https?:\/\//.test(row.source_url)) return null;
  if ([row.quantity, row.annual_income_per_unit, row.native_annual_income, row.fx_rate].some((value) => incomeNumber(value) === null) || incomeNumber(row.fx_rate) === 0) return null;
  return incomeNumber(row.annual_income_jpy);
}
export function summarizeForeignIncome(projection: ForeignIncomeProjection | undefined) {
  if (!projection || !["loaded", "empty"].includes(projection.status)) return { partial: null, complete: null, available: 0, missing: projection?.expectedPositions ?? 0 };
  const amounts = projection.rows.map(foreignRowAmount);
  const available = amounts.filter((amount): amount is number => amount !== null);
  const partial = available.length ? available.reduce((sum, amount) => sum + amount, 0) : projection.status === "empty" ? 0 : null;
  return { partial: partial !== null && Number.isFinite(partial) ? partial : null, complete: available.length === projection.expectedPositions ? partial : null, available: available.length, missing: projection.expectedPositions - available.length };
}
const columns = "user_id,portfolio_id,snapshot_id,snapshot_as_of,portfolio_scope,position_id,account_id,instrument_id,ticker,instrument_name,asset_type,native_currency,quantity,metric_key,observation_as_of,period_start,period_end,source_title,source_url,source_as_of,value_origin,formula_version,annual_income_per_unit,native_annual_income,fx_rate,fx_as_of,fx_source,annual_income_jpy,income_basis,status,exclusion_reason";
/** RLS plus explicit owner/portfolio/current-snapshot filters. Never use old data after failure. */
export async function loadForeignIncome(db: SupabaseClient, userId: string | undefined, portfolioId: string, snapshot: PortfolioSnapshot | null, positions: PortfolioPosition[], external: PortfolioExternalAssets): Promise<ForeignIncomeProjection> {
  if (!snapshot && !external.snapshot) return emptyForeignIncome("no_snapshot");
  if (["error", "loading", "superseded"].includes(external.status)) return emptyForeignIncome("error");
  const expected = [...(snapshot ? positions.filter((p) => (p.assetType === "foreign_stock" || (["equity_fund", "bond_fund"].includes(p.assetType) && p.nativeCurrency !== "JPY"))).map((p) => ({ id: p.id, snapshot: snapshot.id })) : []), ...external.positions.filter((p) => (p.assetType === "foreign_stock" || (["equity_fund", "bond_fund"].includes(p.assetType ?? "") && p.nativeCurrency !== "JPY"))).map((p) => ({ id: p.id, snapshot: external.snapshot!.id }))];
  if (!expected.length) return emptyForeignIncome("empty");
  if (!userId) return emptyForeignIncome("error", expected.length);
  const snapshots = new Map([...(snapshot ? [[snapshot.id, snapshot.asOf] as const] : []), ...(external.snapshot ? [[external.snapshot.id, external.snapshot.asOf] as const] : [])]);
  const byPosition = new Map(expected.map((p) => [p.id, p.snapshot]));
  const scopes = new Map([...(snapshot ? [[snapshot.id, "official"] as const] : []), ...(external.snapshot ? [[external.snapshot.id, "external_reference"] as const] : [])]);
  const rows: ForeignIncomeRow[] = [];
  try {
    for (let from = 0; from < 5000; from += 200) {
      const { data, error } = await db.from("stock_notes_portfolio_current_foreign_income_v").select(columns).eq("user_id", userId).eq("portfolio_id", portfolioId).in("snapshot_id", [...snapshots.keys()]).order("snapshot_id", { ascending: true }).order("position_id", { ascending: true }).range(from, from + 199).returns<ForeignIncomeRow[]>();
      if (error) return emptyForeignIncome(["42P01", "PGRST205"].includes(error.code) ? "missing" : "error", expected.length);
      const page = data ?? []; rows.push(...page);
      if (page.length < 200) {
        const ids = new Set(rows.map((r) => r.position_id));
        if (rows.length !== expected.length || ids.size !== rows.length || rows.some((r) => r.user_id !== userId || r.portfolio_id !== portfolioId || byPosition.get(r.position_id) !== r.snapshot_id || scopes.get(r.snapshot_id) !== r.portfolio_scope || Date.parse(snapshots.get(r.snapshot_id) ?? "") !== Date.parse(r.snapshot_as_of))) return emptyForeignIncome("incomplete", expected.length);
        return { status: "loaded", rows, expectedPositions: expected.length };
      }
    }
  } catch { return emptyForeignIncome("error", expected.length); }
  return emptyForeignIncome("incomplete", expected.length);
}

/** Position IDs preserve account boundaries. External classifications stay unknown. */
export function selectForeignIncome(source: ForeignIncomeProjection | undefined, selectedOfficial: PortfolioPosition[], external: PortfolioExternalAssets, dimension: PortfolioAllocationDimension, scope: PortfolioAllocationScope, memberKeys: string[] | null): ForeignIncomeProjection | undefined {
  if (!source || !["loaded", "empty"].includes(source.status)) return source;
  const ids = new Set(selectedOfficial.map((p) => p.id));
  for (const p of external.positions) {
    if (scope === "equity" && p.assetType !== "foreign_stock") continue;
    const bucket = getPositionAllocationBucket({ ...p, assetType: p.assetType ?? "other", identifier: p.identifier ?? "", name: p.name ?? "", accountType: p.accountType ?? "other", accountName: p.accountName ?? "", institutionName: p.institutionName ?? "", quantity: p.quantity ?? 0, unitCost: null, quotedPrice: null, quoteUnit: 1, unrealizedPnl: null, distributionMethod: null }, dimension, undefined);
    if (!memberKeys || memberKeys.includes(`bucket:${bucket.key}`)) ids.add(p.id);
  }
  const rows = source.rows.filter((row) => ids.has(row.position_id) && (scope !== "equity" || row.asset_type === "foreign_stock"));
  return { ...source, rows, expectedPositions: rows.length, status: rows.length ? "loaded" : "empty" };
}
