// app/tools/stock-notes/earnings-logic.ts
// 決算カレンダー（月次JSON、複数月分）を銘柄コードごとに畳み込む純関数。
// window / fetch など副作用を持たないため、サーバールート
// （app/api/stock-notes/earnings/route.ts）とテストの両方から呼べる。
import type { EarningsCalendarResponse } from "@/app/tools/earnings-calendar/types";
import type { EarningsFoldEntry } from "./earnings-types";

export type FoldEarningsResult = {
  /** 銘柄コード -> today 以降（まだ発表されていない）で最も近い決算予定 */
  next: Record<string, EarningsFoldEntry>;
  /** 銘柄コード -> today 時点で直近の決算日（複数月にまたがる場合は最も新しい過去日） */
  last: Record<string, string>;
};

const PUBLISHED_STATUS = "発表済";

/**
 * 複数月分の決算カレンダーを、銘柄コードごとに1件（直近の未来）＋1件（直近の過去）へ畳み込む。
 * - today（YYYY-MM-DD, JST）より前の予定は「last」の対象にする
 * - today と同日の予定は publish_status を見て振り分ける（設計判断: 日付だけで
 *   「今日はまだ未来」と決め打ちすると、当日発表済みの決算が翌日まで「決算またぎ」に
 *   反映されない。publish_status === "発表済" なら当日でも last 側に入れる）
 * - today より後の予定、および today 中でまだ未発表の予定は「next」の対象にする
 * - 同一銘柄に複数の予定がある場合、next は最も近い日付、last は最も新しい（今日に近い）過去日を選ぶ
 * - null（取得失敗した月）は無視する
 * - codesFilter を渡すと、その銘柄コード集合だけに絞り込む（レスポンスを軽量に保つため）
 */
export function foldEarningsCalendar(
  monthlyResponses: Array<EarningsCalendarResponse | null>,
  todayJst: string,
  codesFilter?: ReadonlySet<string> | null,
): FoldEarningsResult {
  const next: Record<string, EarningsFoldEntry> = {};
  const last: Record<string, string> = {};

  for (const response of monthlyResponses) {
    if (!response) continue;
    for (const day of response.calendar) {
      if (!day.items || day.items.length === 0) continue;
      for (const item of day.items) {
        const code = item.code?.trim();
        if (!code) continue;
        if (codesFilter && !codesFilter.has(code)) continue;

        const isPast = day.date < todayJst;
        const isPublishedToday = day.date === todayJst && item.publish_status === PUBLISHED_STATUS;

        if (isPast || isPublishedToday) {
          const existing = last[code];
          if (!existing || day.date > existing) {
            last[code] = day.date;
          }
          continue;
        }

        const existing = next[code];
        if (!existing || day.date < existing.date) {
          next[code] = {
            date: day.date,
            announcementType: item.announcement_type,
            publishStatus: item.publish_status,
          };
        }
      }
    }
  }

  return { next, last };
}
