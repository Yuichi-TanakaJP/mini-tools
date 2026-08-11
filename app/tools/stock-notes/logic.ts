// app/tools/stock-notes/logic.ts
// 画面の外側で独立してテストできる純関数群（window / Supabase 非依存）。
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

/**
 * 鮮度バッジの閾値（日数）。
 * stock-notes の分析頻度は決算・ニュース起点で不定期（月〜数ヶ月に1回程度）のため、
 * 90日（≒四半期決算1回分）を「そろそろ確認」、180日（≒半年、決算2回分）を「要更新」の目安にする。
 * 根拠: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export const FRESHNESS_WARN_DAYS = 90;
export const FRESHNESS_DANGER_DAYS = 180;

export type FreshnessLevel = "fresh" | "warn" | "danger" | "unknown";

/** 最終分析日からの経過で鮮度レベルを判定する。分析が無ければ "unknown"。 */
export function freshnessLevel(
  lastAnalyzedAt: string | null | undefined,
  now: Date = new Date(),
): FreshnessLevel {
  if (!lastAnalyzedAt) return "unknown";
  const last = new Date(lastAnalyzedAt).getTime();
  if (!Number.isFinite(last)) return "unknown";
  const days = (now.getTime() - last) / (1000 * 60 * 60 * 24);
  if (days < 0) return "fresh"; // 未来日付（時計ズレ等）は安全側で fresh 扱い
  if (days > FRESHNESS_DANGER_DAYS) return "danger";
  if (days > FRESHNESS_WARN_DAYS) return "warn";
  return "fresh";
}

export type UnanalyzedHolding = {
  code: string;
  name: string;
  quantity: number | null;
};

/**
 * 保有銘柄（my-stocks の tab='holding'）のうち、
 * stock_notes_stocks に存在しない、または分析が0件の銘柄を抽出する。
 * 同一銘柄が複数口座で保有されている場合は1件に集約する。
 */
export function computeUnanalyzedHoldings(
  holdings: MyStockItem[],
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
): UnanalyzedHolding[] {
  const stockByCode = new Map(stocks.map((s) => [s.code, s]));
  const analysisCountByStockId = new Map<string, number>();
  for (const a of analyses) {
    analysisCountByStockId.set(a.stockId, (analysisCountByStockId.get(a.stockId) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const result: UnanalyzedHolding[] = [];
  for (const h of holdings) {
    if (h.tab !== "holding") continue;
    if (seen.has(h.code)) continue;
    seen.add(h.code);
    const stock = stockByCode.get(h.code);
    const hasAnalysis = stock ? (analysisCountByStockId.get(stock.id) ?? 0) > 0 : false;
    if (!stock || !hasAnalysis) {
      result.push({ code: h.code, name: h.name, quantity: h.quantity ?? null });
    }
  }
  return result.sort((a, b) => a.code.localeCompare(b.code));
}

/** ChatGPT カスタムGPTへ貼るための短い分析プロンプト文を組み立てる。 */
export function buildAnalysisPrompt(code: string, name: string): string {
  return `${code} ${name}について、直近の決算と現在の投資判断を整理して`;
}

/**
 * 銘柄の「現在の見立て」を1件選ぶ。
 * created_at ではなく as_of の降順（同値なら created_at の降順）で選ぶ。
 * 過去の分析を当時の日付で as_of に入れて取り込んでいるため、登録順(created_at)では最新にならない。
 */
export function selectLatestThesis(
  theses: StockNoteThesis[],
  stockId: string,
): StockNoteThesis | null {
  const target = theses.filter((t) => t.stockId === stockId);
  if (target.length === 0) return null;
  return target.reduce((latest, cur) => {
    const latestAsOf = new Date(latest.asOf).getTime();
    const curAsOf = new Date(cur.asOf).getTime();
    if (curAsOf !== latestAsOf) return curAsOf > latestAsOf ? cur : latest;
    return new Date(cur.createdAt).getTime() > new Date(latest.createdAt).getTime() ? cur : latest;
  });
}

/** 指定銘柄の分析一覧（新しい順）。 */
export function analysesForStock(
  analyses: StockNoteAnalysis[],
  stockId: string,
): StockNoteAnalysis[] {
  return analyses
    .filter((a) => a.stockId === stockId)
    .slice()
    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
}

/** 指定銘柄の最終分析日（analyzed_at の最大値）。分析が無ければ null。 */
export function latestAnalyzedAt(analyses: StockNoteAnalysis[], stockId: string): string | null {
  const target = analysesForStock(analyses, stockId);
  return target.length > 0 ? target[0].analyzedAt : null;
}

export function analysisCountForStock(analyses: StockNoteAnalysis[], stockId: string): number {
  return analyses.reduce((count, a) => (a.stockId === stockId ? count + 1 : count), 0);
}

export function openActionCountForStock(actions: StockNoteAction[], stockId: string): number {
  return actions.reduce(
    (count, a) => (a.stockId === stockId && a.status === "open" ? count + 1 : count),
    0,
  );
}

/** アクション受信箱の並び順: 期限（due_date）昇順。期限未設定は末尾（作成日昇順）。 */
export function sortOpenActions(actions: StockNoteAction[]): StockNoteAction[] {
  return actions
    .filter((a) => a.status === "open")
    .slice()
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

export function isOverdue(dueDate: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  return Number.isFinite(due) && due < now.getTime();
}

/** tab='holding' の件数。空状態の判定に使う（ウォッチのみ登録時に「保有はすべて分析済み」と誤表示しないため）。 */
export function countHoldingTabItems(holdings: MyStockItem[]): number {
  return holdings.reduce((count, h) => (h.tab === "holding" ? count + 1 : count), 0);
}

/**
 * 非同期取得の「世代（generation）」を管理する。
 * ユーザー切替やログアウトが連続したとき、古いリクエストの結果が新しい画面を
 * 上書きしないようにするためのガード。React に依存しない純粋なユーティリティ。
 *
 * 使い方: 取得を開始する直前に next() でトークンを取得し、取得完了時に
 * isCurrent(token) が true のときだけ setState する。false なら結果を破棄する。
 * ログアウトなど「進行中の取得を無効化したいが新しい取得は開始しない」場合は invalidate() を呼ぶ。
 */
export function createLoadGuard() {
  let token = 0;
  return {
    next(): number {
      token += 1;
      return token;
    },
    isCurrent(candidate: number): boolean {
      return candidate === token;
    },
    invalidate(): void {
      token += 1;
    },
  };
}

export type LoadGuard = ReturnType<typeof createLoadGuard>;
