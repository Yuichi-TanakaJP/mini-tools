// app/tools/stock-notes/earnings-logic.ts
// 決算カレンダー（月次JSON、複数月分）を銘柄コードごとに畳み込む純関数。
// window / fetch など副作用を持たないため、サーバールート
// （app/api/stock-notes/earnings/route.ts）とテストの両方から呼べる。
import type { EarningsCalendarResponse } from "@/app/tools/earnings-calendar/types";
import type { EarningsFoldEntry } from "./earnings-types";

export type FoldEarningsResult = {
  /** 銘柄コード -> today 以降で最も近い決算予定 */
  next: Record<string, EarningsFoldEntry>;
  /** 銘柄コード -> today より前の直近の決算日（複数月にまたがる場合は最も新しい過去日） */
  last: Record<string, string>;
};

/**
 * 複数月分の決算カレンダーを、銘柄コードごとに1件（直近の未来）＋1件（直近の過去）へ畳み込む。
 * - today（YYYY-MM-DD, JST）以降の予定だけを「next」の対象にする（今日を含む）
 * - today より前の予定は「last」の対象にする
 * - 同一銘柄に複数の予定がある場合、next は最も近い日付、last は最も新しい（今日に近い）過去日を選ぶ
 * - null（取得失敗した月）は無視する
 */
export function foldEarningsCalendar(
  monthlyResponses: Array<EarningsCalendarResponse | null>,
  todayJst: string,
): FoldEarningsResult {
  const next: Record<string, EarningsFoldEntry> = {};
  const last: Record<string, string> = {};

  for (const response of monthlyResponses) {
    if (!response) continue;
    for (const day of response.calendar) {
      if (!day.items || day.items.length === 0) continue;
      const isFuture = day.date >= todayJst;
      for (const item of day.items) {
        const code = item.code?.trim();
        if (!code) continue;

        if (isFuture) {
          const existing = next[code];
          if (!existing || day.date < existing.date) {
            next[code] = {
              date: day.date,
              announcementType: item.announcement_type,
              publishStatus: item.publish_status,
            };
          }
        } else {
          const existing = last[code];
          if (!existing || day.date > existing) {
            last[code] = day.date;
          }
        }
      }
    }
  }

  return { next, last };
}
