/**
 * 権利付き最終日の算出（TSE 月末最終営業日 - 2 営業日）。
 *
 * 優待の権利確定日は銘柄ごとに異なるが、大半は月末締めのため
 * 「権利月の月末最終営業日の 2 営業日前」を権利付最終日として近似する。
 * 月末締め以外（15 日・20 日締め等）の銘柄は対象外（ズレを許容）。
 *
 * fs へ依存しない純粋関数のみを置き、サーバー / クライアント双方から利用する。
 */

/**
 * 月末近く（月の後半）に位置する TSE 非営業日。
 * これ以外の祝日は月末最終営業日の計算に影響しないため対象外。
 *
 * - 4/29 昭和の日（固定）: 翌月切替判定に影響する唯一の固定祝日
 * - 4/30 振替: 4/29 が日曜の年（2029 年）
 * - 12/31 大納会: TSE 年末休場（固定）
 *
 * 2030 年以降に利用する場合は末尾に追記すること。
 */
const JP_LATE_MONTH_NON_TRADING = new Set([
  "2025-04-29",
  "2026-04-29",
  "2027-04-29",
  "2028-04-29",
  "2029-04-29",
  "2029-04-30", // 4/29 が日曜のため振替
  "2025-12-31",
  "2026-12-31",
  "2027-12-31",
  "2028-12-31",
  "2029-12-31",
]);

export function isBusinessDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0 || dow === 6) return false;
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return !JP_LATE_MONTH_NON_TRADING.has(key);
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 権利付き最終日（日）を返す。
 * = 月末最終営業日 - 2 営業日
 */
export function getKenriLastDay(year: number, month: number): number {
  const lastCalendarDay = new Date(year, month, 0).getDate();
  // 月末から遡って最終営業日を探す
  let day = lastCalendarDay;
  while (!isBusinessDay(year, month, day)) day--;
  // そこからさらに 2 営業日戻る
  let remaining = 2;
  while (remaining > 0) {
    day--;
    if (isBusinessDay(year, month, day)) remaining--;
  }
  return day;
}

export function getKenriLastDateForMonthId(monthId: string): string | null {
  const match = monthId.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return formatIsoDate(year, month, getKenriLastDay(year, month));
}

/**
 * 起点の日付から businessDays 営業日後の日付を返す（週末・年末年始などの休場日は飛ばす）。
 */
function advanceBusinessDays(from: Date, businessDays: number): Date {
  const cursor = new Date(from);
  let remaining = businessDays;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())) {
      remaining -= 1;
    }
  }
  return cursor;
}

/**
 * 今日から businessDays 営業日後までの暦日数を返す（週末・年末年始などを跨げばその分増える）。
 * 制度信用買い→現引きまでの買方金利日数（暦日）の算出に使う。
 */
export function getCalendarDaysForBusinessDays(
  today: { year: number; month: number; day: number },
  businessDays: number,
): number {
  const start = new Date(today.year, today.month - 1, today.day);
  const end = advanceBusinessDays(start, businessDays);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export type UpcomingKenriInfo = {
  /** 権利付最終日（YYYY-MM-DD） */
  kenriLastDate: string;
  /** 現渡しの受渡日＝返却日（YYYY-MM-DD）。権利付最終日から returnBusinessDaysAfterKenri 営業日後。 */
  returnDate: string;
  /** 今日から返却日までの暦日数（最低 1）。貸株料の対象日数。 */
  sellHoldingDays: number;
};

/**
 * 権利月（1..12）ごとに、今日から見て次回の権利付最終日と、返却日（現渡し受渡日）、
 * 今日→返却日の暦日数を返す。今年の権利付最終日を既に過ぎている月は翌年扱いにする。
 *
 * 返却日 = 権利付最終日 + returnBusinessDaysAfterKenri 営業日。
 * 週末・年末年始などの休場は営業日カウントで自然に飛ばすため、月末が金曜だったり
 * 年末を跨ぐと返却日（＝貸株料の終点）が通常より後ろにずれる。
 */
export function getUpcomingKenriInfoByMonth(
  today: { year: number; month: number; day: number },
  returnBusinessDaysAfterKenri: number,
): Record<number, UpcomingKenriInfo> {
  const todayDate = new Date(today.year, today.month - 1, today.day);
  const result: Record<number, UpcomingKenriInfo> = {};
  for (let month = 1; month <= 12; month++) {
    let year = today.year;
    let kenriDay = getKenriLastDay(year, month);
    let kenriDate = new Date(year, month - 1, kenriDay);
    if (kenriDate.getTime() < todayDate.getTime()) {
      year += 1;
      kenriDay = getKenriLastDay(year, month);
      kenriDate = new Date(year, month - 1, kenriDay);
    }
    const returnDate = advanceBusinessDays(kenriDate, returnBusinessDaysAfterKenri);
    const sellHoldingDays = Math.max(
      1,
      Math.round((returnDate.getTime() - todayDate.getTime()) / 86_400_000),
    );
    result[month] = {
      kenriLastDate: formatIsoDate(year, month, kenriDay),
      returnDate: formatIsoDate(returnDate.getFullYear(), returnDate.getMonth() + 1, returnDate.getDate()),
      sellHoldingDays,
    };
  }
  return result;
}
