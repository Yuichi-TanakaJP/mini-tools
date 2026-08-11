// app/tools/stock-notes/earnings-types.ts
// 次回決算日サーバールート（app/api/stock-notes/earnings/route.ts）の
// レスポンス型と、その畳み込みに使う型。
// 決算カレンダー本体の型（EarningsCalendarResponse 等）は
// app/tools/earnings-calendar/types.ts を再利用する。

/** 銘柄コードごとの決算予定・実績1件分（区分・発表状況つき）。next にも last にも使う共通の形。 */
export type EarningsFoldEntry = {
  date: string;
  announcementType: string;
  publishStatus: string;
};

/**
 * /api/stock-notes/earnings のレスポンス。
 * - earnings: 銘柄コード -> 今日以降で最も近い決算予定
 * - lastEarnings: 銘柄コード -> 直近の過去の決算（決算またぎ判定用、かつ画面での「前回決算」表示用）。
 *   date だけでなく区分（announcementType）・発表状況（publishStatus）も持つ。次回決算が未判明の
 *   銘柄では、この情報が唯一の決算関連の手がかりになるため画面に表示する
 *   （詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md）。
 * - windowTo: カレンダーが確定している範囲の終端（manifest.current_window.to）。
 *   manifest の取得に失敗した場合は null。
 * - complete: 対象月（過去分・未来分すべて）の月次JSON取得が全て成功したかどうか。
 *   false の場合、`earnings` / `lastEarnings` に本来あるはずの予定が欠落している可能性がある。
 *   呼び出し側はこれが false のとき、「未判明」ではなく「取得できませんでした」寄りの表示にする
 *   （欠落を「決算が無い」と誤解させないため）。
 * - missingMonths: 取得に失敗した月（YYYY-MM）の一覧。当月が失敗した場合はこのルート自体が
 *   エラーレスポンス（502）を返すため、ここに入るのは当月以外の月だけ。
 */
export type StockNotesEarningsInfo = {
  asOfDate: string;
  windowTo: string | null;
  earnings: Record<string, EarningsFoldEntry>;
  lastEarnings: Record<string, EarningsFoldEntry>;
  complete: boolean;
  missingMonths: string[];
};
