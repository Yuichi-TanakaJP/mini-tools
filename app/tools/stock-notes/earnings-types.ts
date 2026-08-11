// app/tools/stock-notes/earnings-types.ts
// 次回決算日サーバールート（app/api/stock-notes/earnings/route.ts）の
// レスポンス型と、その畳み込みに使う型。
// 決算カレンダー本体の型（EarningsCalendarResponse 等）は
// app/tools/earnings-calendar/types.ts を再利用する。

/** 銘柄コードごとの直近の未来の決算予定。 */
export type EarningsFoldEntry = {
  date: string;
  announcementType: string;
  publishStatus: string;
};

/**
 * /api/stock-notes/earnings のレスポンス。
 * - earnings: 銘柄コード -> 今日以降で最も近い決算予定
 * - lastEarnings: 銘柄コード -> 直近の過去の決算日（決算またぎ判定用）
 * - windowTo: カレンダーが確定している範囲の終端（manifest.current_window.to）。
 *   取得できなかった場合は null（「未判明」表示ではこの日付が無くても文言は出せる）。
 */
export type StockNotesEarningsInfo = {
  asOfDate: string;
  windowTo: string | null;
  earnings: Record<string, EarningsFoldEntry>;
  lastEarnings: Record<string, string>;
};
