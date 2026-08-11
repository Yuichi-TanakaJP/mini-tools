// app/tools/stock-notes/data.ts
// Supabase から stock-notes のテーブルを読み取り専用で取得する。
// 書き込み（insert/update/delete）は行わない。
// - stock_notes_* は本人の行だけが RLS で見える（auth.uid() = user_id）。
// - my_stocks_items_v1（保有リスト）は既存の /api/sync（tool_data 経由）で読む。
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeItems } from "@/app/tools/my-stocks/storage";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
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
 * 保有リストは my-stocks の正本（tool_data の my_stocks_items_v1）を
 * 既存の /api/sync 経由で読む。my-stocks の LocalStorage は直接読まない
 * （この端末とは限らないため）。未ログイン・未設定時は空配列を返す。
 */
export async function fetchHoldings(): Promise<MyStockItem[]> {
  const res = await fetch("/api/sync", { method: "GET" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Array<{ key: string; value: unknown }> };
  const item = (data.items ?? []).find((it) => it.key === "my_stocks_items_v1");
  if (!item) return [];
  return normalizeItems(item.value);
}
