import type { JpxMarketClosedResponse } from "@/lib/market-calendar-types";

type FirstUsableDayDataResult<T> = {
  matched: {
    date: string;
    dayData: T;
  } | null;
  skippedDates: string[];
};

function getDayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekendDate(dateStr: string) {
  const day = getDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

export function filterVisibleTradingDates(
  dates: string[],
  holidays: JpxMarketClosedResponse | null,
) {
  const closedDateSet = new Set(
    (holidays?.days ?? [])
      .filter((day) => day.market_closed)
      .map((day) => day.date),
  );

  return dates.filter((date) => {
    if (closedDateSet.has(date)) {
      return false;
    }

    return !isWeekendDate(date);
  });
}

export async function findFirstUsableDayData<T>(
  dates: string[],
  loadDayData: (date: string) => Promise<T | null>,
  isUsable: (dayData: T | null) => dayData is T,
): Promise<FirstUsableDayDataResult<T>> {
  const skippedDates: string[] = [];

  for (const date of dates) {
    const dayData = await loadDayData(date);
    if (!isUsable(dayData)) {
      skippedDates.push(date);
      continue;
    }

    return {
      matched: { date, dayData },
      skippedDates,
    };
  }

  return {
    matched: null,
    skippedDates,
  };
}
