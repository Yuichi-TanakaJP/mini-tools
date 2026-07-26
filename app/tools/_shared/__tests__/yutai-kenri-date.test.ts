import { describe, expect, it } from "vitest";
import {
  getCalendarDaysForBusinessDays,
  getKenriLastDateForMonthId,
  getKenriLastDay,
  getUpcomingKenriInfoByMonth,
} from "../yutai-kenri-date";

describe("getKenriLastDay", () => {
  it("月末最終営業日の2営業日前を返す（2026-03: 月末31日(火) → 27日(金)）", () => {
    // 2026-03-31 は火曜。最終営業日=31、その2営業日前=27（金）。
    expect(getKenriLastDay(2026, 3)).toBe(27);
  });

  it("月末が土日をまたぐ場合も営業日ベースで遡る（2026-05: 31日(日)）", () => {
    // 2026-05-31 は日曜。最終営業日=29(金)、2営業日前=27(水)。
    expect(getKenriLastDay(2026, 5)).toBe(27);
  });
});

describe("getKenriLastDateForMonthId", () => {
  it("YYYY-MM から権利付最終日の ISO 文字列を返す", () => {
    expect(getKenriLastDateForMonthId("2026-03")).toBe("2026-03-27");
  });

  it("不正な入力は null", () => {
    expect(getKenriLastDateForMonthId("2026-13")).toBeNull();
    expect(getKenriLastDateForMonthId("bad")).toBeNull();
  });
});

describe("getCalendarDaysForBusinessDays", () => {
  it("週末を跨がない平日始点なら営業日数＝暦日数", () => {
    // 2026-07-27(月) から 2営業日後 = 2026-07-29(水) → 2 暦日
    expect(getCalendarDaysForBusinessDays({ year: 2026, month: 7, day: 27 }, 2)).toBe(2);
  });

  it("週末を跨ぐ場合は暦日数が増える", () => {
    // 2026-07-30(木) から 2営業日後 = 2026-08-03(月) → 4 暦日（土日を跨ぐ）
    expect(getCalendarDaysForBusinessDays({ year: 2026, month: 7, day: 30 }, 2)).toBe(4);
  });

  it("0営業日なら0", () => {
    expect(getCalendarDaysForBusinessDays({ year: 2026, month: 7, day: 27 }, 0)).toBe(0);
  });
});

describe("getUpcomingKenriInfoByMonth", () => {
  it("権利付最終日を過ぎた月は翌年扱いにする", () => {
    // 2026-03-28 時点: 3月の権利付最終日(27)は過ぎているので翌年へ。
    const info = getUpcomingKenriInfoByMonth({ year: 2026, month: 3, day: 28 });
    expect(info[3].kenriLastDate).toBe("2027-03-29");
    expect(info[3].daysFromToday).toBeGreaterThan(300);
  });

  it("同年の未来の権利付最終日までの暦日数を返す", () => {
    const info = getUpcomingKenriInfoByMonth({ year: 2026, month: 3, day: 1 });
    expect(info[3].kenriLastDate).toBe("2026-03-27");
    expect(info[3].daysFromToday).toBe(26);
  });

  it("全 12 か月分を返し、日数は最低 1", () => {
    const info = getUpcomingKenriInfoByMonth({ year: 2026, month: 7, day: 26 });
    expect(Object.keys(info)).toHaveLength(12);
    for (let m = 1; m <= 12; m++) {
      expect(info[m].daysFromToday).toBeGreaterThanOrEqual(1);
    }
  });
});
