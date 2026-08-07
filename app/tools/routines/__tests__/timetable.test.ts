import { describe, expect, it } from "vitest";
import type { Routine } from "../types";
import {
  UNTIMED_SLOT,
  WEEKDAYS,
  buildAdhocRoutines,
  buildMonthlyEntries,
  buildWeeklyTimetable,
  summarize,
} from "../timetable";

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    label: "テスト",
    description: "説明",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["06:00"] },
    source: "test_task",
    repo: "market_info",
    ...overrides,
  };
}

describe("buildWeeklyTimetable", () => {
  it("daily は全曜日に並ぶ", () => {
    const rows = buildWeeklyTimetable([routine()]);

    expect(rows).toHaveLength(1);
    expect(rows[0].time).toBe("06:00");
    expect(rows[0].cells).toHaveLength(WEEKDAYS.length);
    expect(rows[0].cells.every((cell) => cell.length === 1)).toBe(true);
  });

  it("weekly は指定曜日だけに並ぶ", () => {
    const rows = buildWeeklyTimetable([
      routine({ schedule: { kind: "weekly", weekdays: [4], times: ["16:30"] } }),
    ]);

    // WEEKDAYS は月始まりなので木曜は index 3
    expect(rows[0].cells[3]).toHaveLength(1);
    expect(rows[0].cells[0]).toHaveLength(0);
  });

  it("weekday は月〜金だけに並ぶ", () => {
    const rows = buildWeeklyTimetable([
      routine({ schedule: { kind: "weekday", times: ["09:00"] } }),
    ]);

    const counts = rows[0].cells.map((cell) => cell.length);
    expect(counts).toEqual([1, 1, 1, 1, 1, 0, 0]);
  });

  it("複数時刻を持つルーティンは時刻ごとに行が分かれる", () => {
    const rows = buildWeeklyTimetable([
      routine({ schedule: { kind: "daily", times: ["08:00", "20:00"] } }),
    ]);

    expect(rows.map((row) => row.time)).toEqual(["08:00", "20:00"]);
  });

  it("行は時刻の昇順で、時刻未定は最後に来る", () => {
    const rows = buildWeeklyTimetable([
      routine({ id: "a", schedule: { kind: "daily", times: ["21:30"] } }),
      routine({ id: "b", schedule: { kind: "weekday", times: [] } }),
      routine({ id: "c", schedule: { kind: "daily", times: ["00:35"] } }),
    ]);

    expect(rows.map((row) => row.time)).toEqual(["00:35", "21:30", UNTIMED_SLOT]);
  });

  it("同じ時刻・同じ曜日のルーティンは同じセルに積まれる", () => {
    const rows = buildWeeklyTimetable([
      routine({ id: "a", schedule: { kind: "daily", times: ["20:00"] } }),
      routine({ id: "b", schedule: { kind: "daily", times: ["20:00"] } }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].cells[0].map((cell) => cell.routine.id)).toEqual(["a", "b"]);
  });

  it("monthly と adhoc は週次グリッドに出さない", () => {
    const rows = buildWeeklyTimetable([
      routine({ id: "m", schedule: { kind: "monthly", daysOfMonth: [1], times: ["06:00"] } }),
      routine({ id: "h", schedule: { kind: "adhoc" } }),
    ]);

    expect(rows).toEqual([]);
  });
});

describe("buildMonthlyEntries", () => {
  it("実行日の早い順に並ぶ", () => {
    const entries = buildMonthlyEntries([
      routine({ id: "late", schedule: { kind: "monthly", daysOfMonth: [7], times: ["12:00"] } }),
      routine({ id: "early", schedule: { kind: "monthly", daysOfMonth: [1], times: ["08:00"] } }),
    ]);

    expect(entries.map((entry) => entry.routine.id)).toEqual(["early", "late"]);
  });

  it("同じ日なら時刻順に並ぶ", () => {
    const entries = buildMonthlyEntries([
      routine({ id: "b", schedule: { kind: "monthly", daysOfMonth: [1], times: ["09:00"] } }),
      routine({ id: "a", schedule: { kind: "monthly", daysOfMonth: [1], times: ["06:00"] } }),
    ]);

    expect(entries.map((entry) => entry.routine.id)).toEqual(["a", "b"]);
  });

  it("連続した実行日は範囲表記にまとめる", () => {
    const entries = buildMonthlyEntries([
      routine({
        schedule: { kind: "monthly", daysOfMonth: [3, 4, 5, 6, 7, 8, 9, 10], times: ["12:00"] },
      }),
    ]);

    expect(entries[0].daysLabel).toBe("3〜10日");
  });

  it("飛び飛びの実行日は中黒で並べる", () => {
    const entries = buildMonthlyEntries([
      routine({ schedule: { kind: "monthly", daysOfMonth: [1, 15], times: ["06:00"] } }),
    ]);

    expect(entries[0].daysLabel).toBe("1・15日");
  });
});

describe("buildAdhocRoutines", () => {
  it("周期のないルーティンだけを返す", () => {
    const routines = buildAdhocRoutines([
      routine({ id: "a", schedule: { kind: "adhoc" } }),
      routine({ id: "b" }),
    ]);

    expect(routines.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("summarize", () => {
  it("週次の実行回数を曜日数×時刻数で数える", () => {
    const summary = summarize([
      routine({ id: "a", schedule: { kind: "daily", times: ["08:00", "20:00"] } }),
      routine({ id: "b", schedule: { kind: "weekly", weekdays: [1], times: ["06:00"] } }),
    ]);

    expect(summary.weeklyRuns).toBe(7 * 2 + 1);
  });

  it("時刻未設定の週次ルーティンも 1 回として数える", () => {
    const summary = summarize([routine({ schedule: { kind: "weekday", times: [] } })]);

    expect(summary.weeklyRuns).toBe(5);
  });

  it("月次の複数日指定は再試行枠なので 1 回として数える", () => {
    const summary = summarize([
      routine({
        schedule: { kind: "monthly", daysOfMonth: [3, 4, 5, 6, 7, 8, 9, 10], times: ["12:00"] },
      }),
    ]);

    expect(summary.monthlyRuns).toBe(1);
    expect(summary.weeklyRuns).toBe(0);
  });

  it("mode ごとの件数と不定期件数を数える", () => {
    const summary = summarize([
      routine({ id: "a", mode: "auto" }),
      routine({ id: "b", mode: "semi" }),
      routine({ id: "c", mode: "manual", schedule: { kind: "adhoc" } }),
      routine({ id: "d", mode: "manual", schedule: { kind: "adhoc" } }),
    ]);

    expect(summary.byMode).toEqual({ auto: 1, semi: 1, manual: 2 });
    expect(summary.adhocCount).toBe(2);
  });
});
