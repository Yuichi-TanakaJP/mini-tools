// app/tools/stock-notes/types.ts
// stock-notes（別リポジトリ）が Supabase に書き込んでいるテーブルの読み取り専用の型。
// 正本のスキーマは stock-notes リポの supabase/schema.sql。
// このツールは読み取り専用のため INSERT/UPDATE/DELETE 用の型は持たない。

export type StockNoteCategory = "holding" | "watch" | "research" | "archived";

export type StockNoteAnalysisType = "earnings" | "financial" | "initial" | "news" | "other";

export type StockNoteView = "bullish" | "neutral" | "bearish";

export type StockNoteConfidence = "high" | "medium" | "low";

export type StockNoteActionStatus = "open" | "done" | "dismissed";

/** stock_notes_stocks の1行（読み取り専用・camelCase化） */
export type StockNoteStock = {
  id: string;
  code: string;
  name: string;
  category: StockNoteCategory;
  categoryChangedAt: string | null;
  categoryChangeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * stock_notes_analyses の1行。一覧表示用に `body`（会話原文・最大4.5万文字）を含めない。
 * body は詳細画面で明示操作したときだけ別クエリで取得する。
 */
export type StockNoteAnalysis = {
  id: string;
  stockId: string;
  analysisType: StockNoteAnalysisType;
  conclusion: string | null;
  evidence: string | null;
  concerns: string | null;
  source: string | null;
  sourceUrl: string | null;
  analyzedAt: string;
  createdAt: string;
};

/** 会話原文（明示操作でのみ取得） */
export type StockNoteAnalysisBody = {
  id: string;
  body: string | null;
};

/** stock_notes_theses の1行。thesis/risks/nextCheck は jsonb 配列（文字列配列として扱う）。 */
export type StockNoteThesis = {
  id: string;
  stockId: string;
  view: StockNoteView;
  confidence: StockNoteConfidence;
  thesis: string[];
  risks: string[];
  nextCheck: string[];
  buyMoreCondition: string | null;
  exitCondition: string | null;
  /** この見立てが「いつ時点」か。最新の見立て判定は created_at ではなくこの as_of の降順で行う。 */
  asOf: string;
  createdAt: string;
};

/** stock_notes_actions の1行 */
export type StockNoteAction = {
  id: string;
  stockId: string;
  actionType: string;
  title: string;
  detail: string | null;
  triggerCondition: string | null;
  dueDate: string | null;
  status: StockNoteActionStatus;
  createdAt: string;
};

/** ダッシュボードが1回のロードで保持するデータ一式。 */
export type StockNotesDashboardData = {
  stocks: StockNoteStock[];
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
};
