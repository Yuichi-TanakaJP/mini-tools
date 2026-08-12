// app/tools/stock-notes/load.ts
// ダッシュボードのデータ取得をまとめて orchestrate する。
// React に依存しない純粋な非同期関数として切り出し、ToolClient から呼ぶ。
// これにより「/api/sync の 401 だけ専用文言にする」ような分岐をユニットテストできる。
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import { HoldingsFetchError, isSessionExpiredSupabaseError, type HoldingsWithSync } from "./data";
import type { StockNotesEarningsInfo } from "./earnings-types";
import type { StockNoteAction, StockNoteAnalysis, StockNoteStock, StockNoteThesis } from "./types";

export type DashboardFetchers = {
  fetchStocks: () => Promise<StockNoteStock[]>;
  fetchAnalyses: () => Promise<StockNoteAnalysis[]>;
  fetchTheses: () => Promise<StockNoteThesis[]>;
  fetchOpenActions: () => Promise<StockNoteAction[]>;
  fetchHoldings: () => Promise<HoldingsWithSync>;
  /**
   * 次回決算日の取得（/api/stock-notes/earnings）。
   * 対象銘柄コード一覧（stocks + holdings から求める）を渡し、サーバー側で絞り込んでもらう
   * （レスポンスを軽量に保つため。全銘柄を返すと実測1,039銘柄・約140KBになる）。
   * 失敗はダッシュボード全体を失敗させない（下記 loadDashboardData のコメント参照）。
   */
  fetchEarnings: (codes: string[]) => Promise<StockNotesEarningsInfo>;
};

export type DashboardData = {
  stocks: StockNoteStock[];
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
  holdings: MyStockItem[];
  /** 保有リスト（/api/sync）の最終同期日時。無ければ null。 */
  holdingsUpdatedAt: string | null;
  /**
   * 次回決算日の情報。取得に失敗した場合、または対象銘柄コードが0件で取得しなかった場合は null。
   * null は「決算予定が無い（未判明）」とは別の状態として扱い、
   * 画面側で「決算情報を取得できませんでした」と表示する。
   */
  earnings: StockNotesEarningsInfo | null;
};

export type LoadResult =
  | ({ status: "ok" } & DashboardData)
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string };

/**
 * 4テーブル + 保有リストを並列取得したあと、その結果から対象銘柄コード（stocks + holdings の
 * コード集合）を求めて次回決算日を取得する。
 *
 * 決算日の取得を他の5件と同時に開始しない（＝ Promise.all に含めない）理由:
 * `/api/stock-notes/earnings` は対象銘柄コードを ?codes= クエリで受け取り、サーバー側で
 * その銘柄だけに絞り込んで返す（全銘柄を返すと実測約140KBになるため）。
 * 対象コードは stocks（分析済み銘柄）と holdings（保有銘柄）から決まるので、
 * それらの取得が終わるまでは何を渡せばよいか分からない。
 *
 * `/api/sync`（保有リスト）が 401 を返した場合（セッション切れ）、および
 * `stock_notes_*`（Supabase直読み）がセッション切れ相当のエラー（`isSessionExpiredSupabaseError`、
 * PostgRESTの `PGRST301` 等）を返した場合は、一般的な取得失敗と区別できるよう
 * `status: "unauthorized"` を返す。両方を同じ扱いにするのは、呼び出し側
 * （ToolClient.tsx）が stale-while-revalidate でキャッシュ表示を維持する設計のため、
 * セッション切れの結果をうっかり「一般的な取得失敗（キャッシュ維持）」に倒すと、
 * 無効なセッションに基づく古い表示を延々と見せ続けてしまうため。
 * それ以外の失敗は `status: "error"`。
 *
 * 決算日（fetchEarnings）の失敗だけは特別扱い: ダッシュボード本体（銘柄一覧・アクション受信箱、等）は
 * 決算日が無くても表示できるため、失敗してもページ全体を `status: "error"` にはせず、
 * `earnings: null` としてページは表示し、決算日の表示箇所だけ「取得できませんでした」とする。
 */
export async function loadDashboardData(fetchers: DashboardFetchers): Promise<LoadResult> {
  try {
    const [stocks, analyses, theses, actions, holdingsResult] = await Promise.all([
      fetchers.fetchStocks(),
      fetchers.fetchAnalyses(),
      fetchers.fetchTheses(),
      fetchers.fetchOpenActions(),
      fetchers.fetchHoldings(),
    ]);

    const codes = Array.from(
      new Set([...stocks.map((s) => s.code), ...holdingsResult.holdings.map((h) => h.code)]),
    );
    const earnings = codes.length > 0 ? await fetchers.fetchEarnings(codes).catch(() => null) : null;

    return {
      status: "ok",
      stocks,
      analyses,
      theses,
      actions,
      holdings: holdingsResult.holdings,
      holdingsUpdatedAt: holdingsResult.updatedAt,
      earnings,
    };
  } catch (e) {
    if ((e instanceof HoldingsFetchError && e.status === 401) || isSessionExpiredSupabaseError(e)) {
      return {
        status: "unauthorized",
        message: "セッションが切れています。ログインし直してください。",
      };
    }
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
