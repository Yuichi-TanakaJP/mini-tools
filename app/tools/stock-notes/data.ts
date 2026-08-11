// app/tools/stock-notes/data.ts
// Supabase から stock-notes のテーブルを読み取り専用で取得する。
// 書き込み（insert/update/delete）は行わない。
// - stock_notes_* は本人の行だけが RLS で見える（auth.uid() = user_id）。
// - my_stocks_items_v1（保有リスト）は既存の /api/sync（tool_data 経由）で読む。
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeItems } from "@/app/tools/my-stocks/storage";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import type { StockNotesEarningsInfo } from "./earnings-types";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteAnalysisBody,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

type StockRow = {
  id: string;
  code: string;
  name: string;
  category: StockNoteStock["category"];
  category_changed_at: string | null;
  category_change_reason: string | null;
  created_at: string;
  updated_at: string;
};

// body は一覧取得では絶対に select しない（最大4.5万文字・合計16万文字あるため）。
type AnalysisRow = {
  id: string;
  stock_id: string;
  analysis_type: StockNoteAnalysis["analysisType"];
  conclusion: string | null;
  evidence: string | null;
  concerns: string | null;
  source: string | null;
  source_url: string | null;
  analyzed_at: string;
  created_at: string;
};

type ThesisRow = {
  id: string;
  stock_id: string;
  view: StockNoteThesis["view"];
  confidence: StockNoteThesis["confidence"];
  thesis: unknown;
  risks: unknown;
  next_check: unknown;
  buy_more_condition: string | null;
  exit_condition: string | null;
  as_of: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  stock_id: string;
  action_type: string;
  title: string;
  detail: string | null;
  trigger_condition: string | null;
  due_date: string | null;
  status: StockNoteAction["status"];
  created_at: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function fetchStocks(supabase: SupabaseClient): Promise<StockNoteStock[]> {
  const { data, error } = await supabase
    .from("stock_notes_stocks")
    .select("id, code, name, category, category_changed_at, category_change_reason, created_at, updated_at")
    .returns<StockRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    categoryChangedAt: row.category_changed_at,
    categoryChangeReason: row.category_change_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** 一覧・タイムライン用。body は含めない。 */
export async function fetchAnalyses(supabase: SupabaseClient): Promise<StockNoteAnalysis[]> {
  const { data, error } = await supabase
    .from("stock_notes_analyses")
    .select(
      "id, stock_id, analysis_type, conclusion, evidence, concerns, source, source_url, analyzed_at, created_at",
    )
    .returns<AnalysisRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    analysisType: row.analysis_type,
    conclusion: row.conclusion,
    evidence: row.evidence,
    concerns: row.concerns,
    source: row.source,
    sourceUrl: row.source_url,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
  }));
}

/** 会話原文（body）を明示操作時にだけ取得する。 */
export async function fetchAnalysisBody(
  supabase: SupabaseClient,
  analysisId: string,
): Promise<StockNoteAnalysisBody> {
  const { data, error } = await supabase
    .from("stock_notes_analyses")
    .select("id, body")
    .eq("id", analysisId)
    .maybeSingle<{ id: string; body: string | null }>();
  if (error) throw error;
  return { id: data?.id ?? analysisId, body: data?.body ?? null };
}

export async function fetchTheses(supabase: SupabaseClient): Promise<StockNoteThesis[]> {
  const { data, error } = await supabase
    .from("stock_notes_theses")
    .select(
      "id, stock_id, view, confidence, thesis, risks, next_check, buy_more_condition, exit_condition, as_of, created_at",
    )
    .returns<ThesisRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    view: row.view,
    confidence: row.confidence,
    thesis: toStringArray(row.thesis),
    risks: toStringArray(row.risks),
    nextCheck: toStringArray(row.next_check),
    buyMoreCondition: row.buy_more_condition,
    exitCondition: row.exit_condition,
    asOf: row.as_of,
    createdAt: row.created_at,
  }));
}

/** open のアクションだけを対象にする（アクション受信箱は未消化のみ表示するため）。 */
export async function fetchOpenActions(supabase: SupabaseClient): Promise<StockNoteAction[]> {
  const { data, error } = await supabase
    .from("stock_notes_actions")
    .select("id, stock_id, action_type, title, detail, trigger_condition, due_date, status, created_at")
    .eq("status", "open")
    .returns<ActionRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    actionType: row.action_type,
    title: row.title,
    detail: row.detail,
    triggerCondition: row.trigger_condition,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * /api/sync の取得失敗を表すエラー。
 * status を持たせ、呼び出し側で 401（未認証・セッション切れ）とそれ以外を区別できるようにする。
 * これを投げずに空配列へフォールバックすると、「保有0件」と「取得失敗」が区別できなくなり、
 * このツールの主目的（保有だが未分析の可視化）が静かに壊れるため、必ず throw する。
 */
export class HoldingsFetchError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HoldingsFetchError";
    this.status = status;
  }
}

/**
 * 保有リスト（my_stocks_items_v1）と、その最終同期日時。
 * updatedAt は /api/sync（tool_data）の updated_at。
 * これは「保有リストが最後にこの端末からクラウドへ保存された日時」であり、
 * ローカルでの編集が反映されているとは限らない（同期は手動、/account の
 * 「この端末を保存」を押した時だけアップロードされる）。
 * 詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export type HoldingsWithSync = {
  holdings: MyStockItem[];
  updatedAt: string | null;
};

/**
 * 保有リストは my-stocks の正本（tool_data の my_stocks_items_v1）を
 * 既存の /api/sync 経由で読む。my-stocks の LocalStorage は直接読まない
 * （この端末とは限らないため）。
 * 取得失敗（セッション切れ・サーバー障害など）は空配列にフォールバックせず throw する。
 */
export async function fetchHoldings(): Promise<HoldingsWithSync> {
  const res = await fetch("/api/sync", { method: "GET" });
  if (!res.ok) {
    throw new HoldingsFetchError(res.status, `保有リストの取得に失敗しました（HTTP ${res.status}）`);
  }
  const data = (await res.json()) as {
    items?: Array<{ key: string; value: unknown; updatedAt?: string }>;
  };
  const item = (data.items ?? []).find((it) => it.key === "my_stocks_items_v1");
  if (!item) return { holdings: [], updatedAt: null };
  return { holdings: normalizeItems(item.value), updatedAt: item.updatedAt ?? null };
}

/**
 * 次回決算日を /api/stock-notes/earnings（サーバールート）から取得する。
 * このルートは月次JSON（1本約500KB）をサーバー側で畳み込んでから返すため、
 * クライアントには銘柄コードごとの最小限の情報だけが届く。
 * 失敗時は呼び出し側（load.ts）でキャッチし、ダッシュボード全体は失敗させず
 * 「決算情報を取得できませんでした」の表示に落とす。
 */
export async function fetchEarnings(): Promise<StockNotesEarningsInfo> {
  const res = await fetch("/api/stock-notes/earnings", { method: "GET" });
  if (!res.ok) {
    throw new Error(`決算日の取得に失敗しました（HTTP ${res.status}）`);
  }
  return (await res.json()) as StockNotesEarningsInfo;
}
