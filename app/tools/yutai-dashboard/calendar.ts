import {
  getPreparationMonth,
  resolveEntitlementMonthKey,
  toJstYearMonth,
} from "@/app/tools/yutai-memo/date-utils";
import type { ArchivedMemoItem, MemoItem } from "@/app/tools/yutai-memo/types";

// 12ヶ月ガント風ビューの 1 セル状態
export type CalendarMonthCell = {
  entitlement: boolean; // 権利月
  prepStart: boolean; // 仕込み開始月
  band: boolean; // 仕込み開始〜権利月の帯
  prepCompleted: boolean; // 取得（＝仕込み）を実施した月
  acquiredThisYear: boolean; // 選択年度にその権利月を取得済み
  acquiredPast: boolean; // 選択年度以外に取得実績がある
  acquiredYears: number[]; // その権利月を取得した年（ツールチップ用）
  oneShareHeld: boolean; // 選択年度にその月 1 株を保有中
  oneShareStart: boolean; // 選択年度に 1 株保有を開始した月
};

function parseYearMonth(value: string | undefined): { year: number; month: number } | null {
  const matched = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

function monthFromIso(value: string): number | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return toJstYearMonth(new Date(timestamp)).month;
}

// 1 銘柄メモの、選択年度における 12ヶ月セルを組み立てる。
// 権利月・仕込み計画は年度非依存。取得・仕込み実施・1株保有は選択年度で解釈する。
export function buildCalendarCells(
  memo: MemoItem,
  archives: ArchivedMemoItem[],
  selectedYear: number,
  nowIso: string,
): CalendarMonthCell[] {
  const cells: CalendarMonthCell[] = Array.from({ length: 12 }, () => ({
    entitlement: false,
    prepStart: false,
    band: false,
    prepCompleted: false,
    acquiredThisYear: false,
    acquiredPast: false,
    acquiredYears: [],
    oneShareHeld: false,
    oneShareStart: false,
  }));
  const yearsByMonth = new Map<number, Set<number>>();
  const memoMonths = new Set(
    (memo.months ?? []).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
  );

  for (const archive of archives) {
    const entitlement = parseYearMonth(archive.entitlementMonthKey);
    if (!entitlement || !memoMonths.has(entitlement.month)) continue;
    const years = yearsByMonth.get(entitlement.month) ?? new Set<number>();
    years.add(entitlement.year);
    yearsByMonth.set(entitlement.month, years);

    if (entitlement.year === selectedYear) {
      const preparedMonth = monthFromIso(archive.acquiredAt);
      if (preparedMonth) cells[preparedMonth - 1].prepCompleted = true;
    }
  }

  if (memo.acquired) {
    const entitlement = parseYearMonth(
      resolveEntitlementMonthKey(
        memo.months,
        memo.acquiredMarkedAt ?? nowIso,
        memo.preparationMonthsBefore,
      ) ?? undefined,
    );
    if (entitlement) {
      const years = yearsByMonth.get(entitlement.month) ?? new Set<number>();
      years.add(entitlement.year);
      yearsByMonth.set(entitlement.month, years);

      if (entitlement.year === selectedYear && memo.acquiredMarkedAt) {
        const preparedMonth = monthFromIso(memo.acquiredMarkedAt);
        if (preparedMonth) cells[preparedMonth - 1].prepCompleted = true;
      }
    }
  }

  for (const entitlement of memoMonths) {
    const cell = cells[entitlement - 1];
    cell.entitlement = true;
    const years = yearsByMonth.get(entitlement);
    if (years) {
      cell.acquiredYears = [...years].sort((a, b) => a - b);
      cell.acquiredThisYear = years.has(selectedYear);
      cell.acquiredPast = cell.acquiredYears.some((year) => year !== selectedYear);
    }
    if (memo.preparationMonthsBefore === undefined) continue;
    const prepStart = getPreparationMonth(entitlement, memo.preparationMonthsBefore);
    if (!prepStart) continue;
    cells[prepStart - 1].prepStart = true;
    // prepStart から entitlement まで循環しながら帯を塗る
    let month = prepStart;
    for (let guard = 0; guard < 12; guard += 1) {
      cells[month - 1].band = true;
      if (month === entitlement) break;
      month = (month % 12) + 1;
    }
  }

  // 1株保有: 選択年度で解釈する。開始年より後=通年、開始年=開始月〜12月、開始前=非保有。
  // 開始が YYYY-MM で分からない（フリーテキスト）場合のみ年不明として通年保有扱い。
  if (memo.oneShareStartedAt) {
    const start = parseYearMonth(memo.oneShareStartedAt);
    if (!start) {
      for (const cell of cells) cell.oneShareHeld = true;
    } else if (selectedYear > start.year) {
      for (const cell of cells) cell.oneShareHeld = true;
    } else if (selectedYear === start.year) {
      for (let month = start.month; month <= 12; month += 1) cells[month - 1].oneShareHeld = true;
      cells[start.month - 1].oneShareStart = true;
    }
  }
  return cells;
}
