import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSyncConfigured } from "@/lib/supabase/config";

export const SCREEN_PATH = "/tools/stock-notes/screening";
export const PAGE_SIZE = 50;

const codePattern = /^[0-9A-Z]{4}$/;
const filterPattern = /^-?(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const snapshotPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type SearchParams = Record<string, string | string[] | undefined>;
export type ScreenFilters = {
  minFcf: string;
  maxDebt: string;
  after: string;
  asOf: string;
};

export const DEBT_LABELS = {
  balance_sheet: "貸借対照表",
  verified: "注記照合済み",
  explicitly_not_applicable: "該当なし（明示）",
} as const;
type DebtBasis = keyof typeof DEBT_LABELS;
type ScreenRow = {
  jpx_code: string;
  edinet_doc_id: string;
  period_end: string;
  source_as_of: string;
  fcf_jpy_million: number;
  disclosed_debt_jpy_million: number;
  debt_basis: DebtBasis;
};

type PageState =
  | { state: "unauthorized" | "unavailable" }
  | { state: "invalid"; filters: ScreenFilters }
  | { state: "failed"; filters: ScreenFilters }
  | { state: "ready"; filters: ScreenFilters; rows: ScreenRow[]; next: string | null };

export function screeningFilters(query: SearchParams, now: Date) {
  const minFcf = query.minFcf;
  const maxDebt = query.maxDebt;
  const after = query.after;
  const asOf = query.asOf;
  const saved: ScreenFilters = { minFcf: "", maxDebt: "", after: "", asOf: now.toISOString() };
  const validNumber = (value: typeof minFcf, debt: boolean) =>
    value === undefined || value === "" ||
    (typeof value === "string" && filterPattern.test(value) && (!debt || !value.startsWith("-")));
  const validMin = validNumber(minFcf, false);
  const validMax = validNumber(maxDebt, true);
  if (validMin && typeof minFcf === "string") saved.minFcf = minFcf;
  if (validMax && typeof maxDebt === "string") saved.maxDebt = maxDebt;
  if (!validMin || !validMax) return { ok: false as const, filters: saved };
  if (after !== undefined && (typeof after !== "string" || !codePattern.test(after) || !asOf)) {
    return { ok: false as const, filters: saved };
  }
  if (asOf !== undefined) {
    if (typeof asOf !== "string" || !snapshotPattern.test(asOf)) return { ok: false as const, filters: saved };
    const cutoff = new Date(asOf);
    if (!Number.isFinite(cutoff.getTime()) || cutoff.toISOString() !== asOf || cutoff > now) {
      return { ok: false as const, filters: saved };
    }
    saved.asOf = asOf;
  }
  if (typeof after === "string") saved.after = after;
  return { ok: true as const, filters: saved };
}

export function screenHref(filters: ScreenFilters, after = filters.after) {
  const query = new URLSearchParams({ asOf: filters.asOf });
  if (filters.minFcf) query.set("minFcf", filters.minFcf);
  if (filters.maxDebt) query.set("maxDebt", filters.maxDebt);
  if (after) query.set("after", after);
  return SCREEN_PATH + "?" + query;
}

function amount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number * 1_000_000)) ? number : null;
}

function rpcRows(value: unknown, filters: ScreenFilters): ScreenRow[] | null {
  if (!Array.isArray(value) || value.length > PAGE_SIZE + 1) return null;
  const rows: ScreenRow[] = [];
  let prior = filters.after;
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const { jpx_code, edinet_doc_id, period_end, source_as_of, debt_basis } = row;
    const fcf = amount(row.fcf_jpy_million);
    const debt = amount(row.disclosed_debt_jpy_million);
    if (
      typeof jpx_code !== "string" || !codePattern.test(jpx_code) || jpx_code <= prior ||
      typeof edinet_doc_id !== "string" || !/^S[A-Z0-9]{7}$/.test(edinet_doc_id) ||
      typeof period_end !== "string" || !datePattern.test(period_end) ||
      typeof source_as_of !== "string" || !Number.isFinite(Date.parse(source_as_of)) ||
      typeof debt_basis !== "string" || !Object.hasOwn(DEBT_LABELS, debt_basis) ||
      fcf === null || debt === null || debt < 0 ||
      (debt_basis === "explicitly_not_applicable" && debt !== 0) ||
      (debt_basis === "verified" && debt === 0)
    ) return null;
    prior = jpx_code;
    rows.push({
      jpx_code, edinet_doc_id, period_end, source_as_of,
      fcf_jpy_million: fcf,
      disclosed_debt_jpy_million: debt,
      debt_basis: debt_basis as DebtBasis,
    });
  }
  return rows;
}

export async function loadScreening(query: SearchParams, now = new Date()): Promise<PageState> {
  if (!isSyncConfigured()) return { state: "unavailable" };
  const parsed = screeningFilters(query, now);
  try {
    const db = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError) {
      if (authError.status === 401 || authError.status === 403 || authError.name === "AuthSessionMissingError") {
        return { state: "unauthorized" };
      }
      return { state: "failed", filters: parsed.filters };
    }
    if (!user) return { state: "unauthorized" };
    if (!parsed.ok) return { state: "invalid", filters: parsed.filters };

    const { filters } = parsed;
    const { data, error } = await db.rpc("stock_notes_screen_edinet_fcf_debt_v1", {
      p_as_of: filters.asOf,
      p_min_fcf_million: filters.minFcf || null,
      p_max_debt_million: filters.maxDebt || null,
      p_after_code: filters.after || null,
      p_limit: PAGE_SIZE + 1,
    });
    if (error?.code === "PGRST301") return { state: "unauthorized" };
    if (error) return { state: "failed", filters };
    const rows = rpcRows(data, filters);
    if (!rows) return { state: "failed", filters };
    return {
      state: "ready",
      filters,
      rows: rows.slice(0, PAGE_SIZE),
      next: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].jpx_code : null,
    };
  } catch {
    return { state: "failed", filters: parsed.filters };
  }
}
