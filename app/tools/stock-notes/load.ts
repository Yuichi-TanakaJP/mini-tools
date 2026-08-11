// app/tools/stock-notes/load.ts
// ダッシュボードのデータ取得をまとめて orchestrate する。
// React に依存しない純粋な非同期関数として切り出し、ToolClient から呼ぶ。
// これにより「/api/sync の 401 だけ専用文言にする」ような分岐をユニットテストできる。
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import { HoldingsFetchError } from "./data";
import type { StockNoteAction, StockNoteAnalysis, StockNoteStock, StockNoteThesis } from "./types";

export type DashboardFetchers = {
  fetchStocks: () => Promise<StockNoteStock[]>;
  fetchAnalyses: () => Promise<StockNoteAnalysis[]>;
  fetchTheses: () => Promise<StockNoteThesis[]>;
  fetchOpenActions: () => Promise<StockNoteAction[]>;
  fetchHoldings: () => Promise<MyStockItem[]>;
};

export type DashboardData = {
  stocks: StockNoteStock[];
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
  holdings: MyStockItem[];
};

export type LoadResult =
  | ({ status: "ok" } & DashboardData)
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

/**
 * 4テーブル + 保有リストを並列取得する。
 * `/api/sync`（保有リスト）が 401 を返した場合（セッション切れ）は、
 * 一般的な取得失敗と区別できるよう `status: "unauthorized"` を返す。
 * それ以外の失敗（他テーブルのエラーや 401 以外の /api/sync エラー）は `status: "error"`。
 */
export async function loadDashboardData(fetchers: DashboardFetchers): Promise<LoadResult> {
  try {
    const [stocks, analyses, theses, actions, holdings] = await Promise.all([
      fetchers.fetchStocks(),
      fetchers.fetchAnalyses(),
      fetchers.fetchTheses(),
      fetchers.fetchOpenActions(),
      fetchers.fetchHoldings(),
    ]);
    return { status: "ok", stocks, analyses, theses, actions, holdings };
  } catch (e) {
    if (e instanceof HoldingsFetchError && e.status === 401) {
      return {
        status: "unauthorized",
        message: "セッションが切れています。ログインし直してください。",
      };
    }
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
