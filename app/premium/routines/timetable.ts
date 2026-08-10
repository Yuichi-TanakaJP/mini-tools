// 週間タイムテーブルと集計の組み立て。
// 描画から切り離した純関数にして、単体テストで検証できるようにする。

import type { Routine, RoutineMode, Weekday } from "./types";

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "日",
  1: "月",
  2: "火",
  3: "水",
  4: "木",
  5: "金",
  6: "土",
};

export const MODE_LABELS: Record<RoutineMode, string> = {
  auto: "自動",
  semi: "半自動",
  manual: "手動",
};

export const MODE_ICONS: Record<RoutineMode, string> = {
  auto: "🤖",
  semi: "⚡",
  manual: "✋",
};

/** 時刻が決まっていないルーティンを置く仮想の行。 */
export const UNTIMED_SLOT = "時刻未定";

export type TimetableCell = {
  routine: Routine;
};

export type TimetableRow = {
  /** "06:30" または UNTIMED_SLOT */
  time: string;
  /** 月〜日の順。WEEKDAYS と同じ並び */
  cells: TimetableCell[][];
};

export type MonthlyEntry = {
  routine: Routine;
  /** 表示用の実行日ラベル。例: "1日", "3〜10日" */
  daysLabel: string;
  time: string;
};

export type RoutineSummary = {
  /** 週あたりの実行回数。adhoc は数えない */
  weeklyRuns: number;
  /** 月あたりの実行回数。monthly は「複数日は再試行なので 1 回」と数える */
  monthlyRuns: number;
  byMode: Record<RoutineMode, number>;
  adhocCount: number;
};

function weekdaysOf(routine: Routine): Weekday[] {
  const { schedule } = routine;
  switch (schedule.kind) {
    case "daily":
      return WEEKDAYS;
    case "weekday":
      return [1, 2, 3, 4, 5];
    case "weekly":
      return schedule.weekdays;
    default:
      return [];
  }
}

function timesOf(routine: Routine): string[] {
  const { schedule } = routine;
  if (schedule.kind === "adhoc") return [];
  // 時刻を決めていない手動ルーティンは、専用の行にまとめる。
  return schedule.times.length > 0 ? schedule.times : [UNTIMED_SLOT];
}

/** 時刻文字列を並べ替える。UNTIMED_SLOT は常に最後。 */
function compareTime(a: string, b: string): number {
  if (a === UNTIMED_SLOT) return b === UNTIMED_SLOT ? 0 : 1;
  if (b === UNTIMED_SLOT) return -1;
  return a.localeCompare(b);
}

/**
 * 週次で回るルーティン（daily / weekday / weekly）を、時刻 × 曜日のグリッドにする。
 * monthly と adhoc はこのグリッドには出さない。
 */
export function buildWeeklyTimetable(routines: Routine[]): TimetableRow[] {
  const byTime = new Map<string, Map<Weekday, Routine[]>>();

  for (const routine of routines) {
    const days = weekdaysOf(routine);
    if (days.length === 0) continue;

    for (const time of timesOf(routine)) {
      let row = byTime.get(time);
      if (!row) {
        row = new Map();
        byTime.set(time, row);
      }
      for (const day of days) {
        const bucket = row.get(day);
        if (bucket) {
          bucket.push(routine);
        } else {
          row.set(day, [routine]);
        }
      }
    }
  }

  return [...byTime.keys()].sort(compareTime).map((time) => {
    const row = byTime.get(time);
    return {
      time,
      cells: WEEKDAYS.map((day) =>
        (row?.get(day) ?? []).map((routine) => ({ routine })),
      ),
    };
  });
}

/** 連続した日を "3〜10日" にまとめる。 */
function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const isContiguous = sorted.every(
    (day, index) => index === 0 || day === sorted[index - 1] + 1,
  );
  if (sorted.length > 1 && isContiguous) {
    return `${sorted[0]}〜${sorted[sorted.length - 1]}日`;
  }
  return `${sorted.join("・")}日`;
}

/** 月次ルーティンを、実行日の早い順に並べる。 */
export function buildMonthlyEntries(routines: Routine[]): MonthlyEntry[] {
  const entries: MonthlyEntry[] = [];

  for (const routine of routines) {
    if (routine.schedule.kind !== "monthly") continue;
    const { daysOfMonth, times } = routine.schedule;
    const daysLabel = formatDays(daysOfMonth);
    for (const time of times.length > 0 ? times : [UNTIMED_SLOT]) {
      entries.push({ routine, daysLabel, time });
    }
  }

  return entries.sort((a, b) => {
    const dayA = Math.min(...(a.routine.schedule as { daysOfMonth: number[] }).daysOfMonth);
    const dayB = Math.min(...(b.routine.schedule as { daysOfMonth: number[] }).daysOfMonth);
    if (dayA !== dayB) return dayA - dayB;
    return compareTime(a.time, b.time);
  });
}

/** 定期実行のないルーティン。 */
export function buildAdhocRoutines(routines: Routine[]): Routine[] {
  return routines.filter((routine) => routine.schedule.kind === "adhoc");
}

export function summarize(routines: Routine[]): RoutineSummary {
  const byMode: Record<RoutineMode, number> = { auto: 0, semi: 0, manual: 0 };
  let weeklyRuns = 0;
  let monthlyRuns = 0;
  let adhocCount = 0;

  for (const routine of routines) {
    byMode[routine.mode] += 1;

    const { schedule } = routine;
    if (schedule.kind === "adhoc") {
      adhocCount += 1;
      continue;
    }
    if (schedule.kind === "monthly") {
      // 3〜10日のような複数日指定は「成功するまでの再試行枠」なので 1 回と数える。
      monthlyRuns += Math.max(schedule.times.length, 1);
      continue;
    }
    const runsPerOccurrence = Math.max(schedule.times.length, 1);
    weeklyRuns += weekdaysOf(routine).length * runsPerOccurrence;
  }

  return { weeklyRuns, monthlyRuns, byMode, adhocCount };
}
