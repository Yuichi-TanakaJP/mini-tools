import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteStock,
  StockNoteThesis,
} from "@/app/tools/stock-notes/types";
import type {
  StockNotesDelta,
  StockNotesManifest,
  StockNotesStockBundle,
} from "@/app/tools/stock-notes/delta";
import { parseStockNotesDelta } from "@/app/tools/stock-notes/delta";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const MAX_KNOWN_MANIFEST_ENTRIES = 2_000;

type StockRow = {
  id: string;
  code: string;
  name: string | null;
  category: StockNoteStock["category"];
  category_changed_at: string | null;
  category_change_reason: string | null;
  created_at: string;
  updated_at: string;
};

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
  confidence: StockNoteThesis["confidence"] | null;
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseKnownManifest(value: unknown): StockNotesManifest {
  if (!isRecord(value) || Object.keys(value).length > MAX_KNOWN_MANIFEST_ENTRIES) return {};
  const manifest: StockNotesManifest = {};
  for (const [stockId, revision] of Object.entries(value)) {
    if (
      stockId.length === 0 ||
      stockId.length > 128 ||
      typeof revision !== "string" ||
      revision.length === 0 ||
      revision.length > 256
    ) {
      return {};
    }
    manifest[stockId] = revision;
  }
  return manifest;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapStock(row: StockRow): StockNoteStock {
  return {
    id: row.id,
    code: row.code,
    name: row.name ?? "",
    category: row.category,
    categoryChangedAt: row.category_changed_at,
    categoryChangeReason: row.category_change_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnalysis(row: AnalysisRow): StockNoteAnalysis {
  return {
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
  };
}

function mapThesis(row: ThesisRow): StockNoteThesis {
  return {
    id: row.id,
    stockId: row.stock_id,
    view: row.view,
    confidence: row.confidence ?? "medium",
    thesis: toStringArray(row.thesis),
    risks: toStringArray(row.risks),
    nextCheck: toStringArray(row.next_check),
    buyMoreCondition: row.buy_more_condition,
    exitCondition: row.exit_condition,
    asOf: row.as_of,
    createdAt: row.created_at,
  };
}

function mapAction(row: ActionRow): StockNoteAction {
  return {
    id: row.id,
    stockId: row.stock_id,
    actionType: row.action_type,
    title: row.title,
    detail: row.detail,
    triggerCondition: row.trigger_condition,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function revisionFor(bundle: Omit<StockNotesStockBundle, "revision">): string {
  return createHash("sha256").update(stableJson(bundle)).digest("hex");
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.id.localeCompare(b.id));
}

function parseRequestBody(value: unknown): StockNotesManifest {
  if (!isRecord(value)) return {};
  return parseKnownManifest(value.knownManifest);
}

export async function POST(request: Request) {
  if (!isSyncConfigured()) return json({ error: "Supabase env is not configured" }, 503);

  let requestBody: unknown = null;
  try {
    requestBody = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const knownManifest = parseRequestBody(requestBody);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  try {
    // DB内でmanifestとRevisionを計算できる場合は、Supabaseから変更銘柄だけを返す。
    // 関数未適用のPreview/旧環境では下記の互換フォールバックを使う。
    const rpcResult = await supabase.rpc("get_stock_notes_delta", {
      p_known_manifest: knownManifest,
    });
    if (!rpcResult.error && rpcResult.data) {
      try {
        return json(parseStockNotesDelta(rpcResult.data));
      } catch (error) {
        console.error("[stock-notes/delta] invalid RPC response; using compatibility path", error);
      }
    }

    const [stocksResult, analysesResult, thesesResult, actionsResult] = await Promise.all([
      supabase
        .from("stock_notes_stocks")
        .select("id, code, name, category, category_changed_at, category_change_reason, created_at, updated_at")
        .returns<StockRow[]>(),
      supabase
        .from("stock_notes_analyses")
        .select("id, stock_id, analysis_type, conclusion, evidence, concerns, source, source_url, analyzed_at, created_at")
        .returns<AnalysisRow[]>(),
      supabase
        .from("stock_notes_theses")
        .select("id, stock_id, view, confidence, thesis, risks, next_check, buy_more_condition, exit_condition, as_of, created_at")
        .returns<ThesisRow[]>(),
      supabase
        .from("stock_notes_actions")
        .select("id, stock_id, action_type, title, detail, trigger_condition, due_date, status, created_at")
        .eq("status", "open")
        .returns<ActionRow[]>(),
    ]);

    const firstError = [stocksResult.error, analysesResult.error, thesesResult.error, actionsResult.error].find(Boolean);
    if (firstError) throw firstError;

    const stocks = sortById(stocksResult.data ?? []).map(mapStock);
    const analyses = sortById(analysesResult.data ?? []).map(mapAnalysis);
    const theses = sortById(thesesResult.data ?? []).map(mapThesis);
    const actions = sortById(actionsResult.data ?? [])
      .filter((row) => row.status === "open")
      .map(mapAction);
    const analysesByStock = new Map<string, StockNoteAnalysis[]>();
    const thesesByStock = new Map<string, StockNoteThesis[]>();
    const actionsByStock = new Map<string, StockNoteAction[]>();
    for (const row of analyses) analysesByStock.set(row.stockId, [...(analysesByStock.get(row.stockId) ?? []), row]);
    for (const row of theses) thesesByStock.set(row.stockId, [...(thesesByStock.get(row.stockId) ?? []), row]);
    for (const row of actions) actionsByStock.set(row.stockId, [...(actionsByStock.get(row.stockId) ?? []), row]);

    const currentManifest: StockNotesManifest = {};
    const bundles = stocks.map((stock) => {
      const withoutRevision = {
        stock,
        analyses: analysesByStock.get(stock.id) ?? [],
        theses: thesesByStock.get(stock.id) ?? [],
        actions: actionsByStock.get(stock.id) ?? [],
      };
      const bundle: StockNotesStockBundle = {
        ...withoutRevision,
        revision: revisionFor(withoutRevision),
      };
      currentManifest[stock.id] = bundle.revision;
      return bundle;
    });

    const changedStocks = Object.keys(knownManifest).length === 0
      ? bundles
      : bundles.filter((bundle) => knownManifest[bundle.stock.id] !== bundle.revision);
    const currentIds = new Set(Object.keys(currentManifest));
    const deletedStockIds = Object.keys(knownManifest).filter((stockId) => !currentIds.has(stockId));

    const body: StockNotesDelta = {
      version: 1,
      complete: true,
      currentManifest,
      changedStocks,
      deletedStockIds,
    };
    return json(body);
  } catch (error) {
    console.error("[stock-notes/delta] failed to build delta", error);
    return json({ error: "銘柄差分を取得できませんでした。" }, 502);
  }
}
