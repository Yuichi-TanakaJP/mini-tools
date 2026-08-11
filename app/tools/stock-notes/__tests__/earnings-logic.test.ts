import { describe, expect, it } from "vitest";
import type { EarningsCalendarResponse } from "@/app/tools/earnings-calendar/types";
import { foldEarningsCalendar } from "../earnings-logic";

function makeMonth(
  asOfDate: string,
  days: Array<{ date: string; codes: Array<{ code: string; announcementType?: string; publishStatus?: string }> }>,
): EarningsCalendarResponse {
  return {
    as_of_date: asOfDate,
    calendar: days.map((day) => ({
      date: day.date,
      count: day.codes.length,
      detail_status: "present",
      items: day.codes.map((c) => ({
        time: "",
        code: c.code,
        name: `${c.code}テスト`,
        market: "プライム",
        announcement_type: c.announcementType ?? "本決算",
        publish_status: c.publishStatus ?? "予定",
        progress_status: "",
      })),
    })),
  };
}

describe("foldEarningsCalendar", () => {
  it("今日以降の予定だけを next に入れ、今日より前は next から除外する", () => {
    const month = makeMonth("2026-08-01", [
      { date: "2026-08-05", codes: [{ code: "7203" }] },
      { date: "2026-08-20", codes: [{ code: "9999" }] },
    ]);
    const { next } = foldEarningsCalendar([month], "2026-08-10");
    expect(next["7203"]).toBeUndefined();
    expect(next["9999"]).toEqual({ date: "2026-08-20", announcementType: "本決算", publishStatus: "予定" });
  });

  it("today と同日は next に含める（今日以降 = 今日を含む）", () => {
    const month = makeMonth("2026-08-01", [{ date: "2026-08-10", codes: [{ code: "7203" }] }]);
    const { next } = foldEarningsCalendar([month], "2026-08-10");
    expect(next["7203"]?.date).toBe("2026-08-10");
  });

  it("複数月にまたがる場合でも銘柄コードごとに畳み込む", () => {
    const aug = makeMonth("2026-08-01", [{ date: "2026-08-20", codes: [{ code: "7203" }] }]);
    const sep = makeMonth("2026-08-01", [{ date: "2026-09-05", codes: [{ code: "6758" }] }]);
    const { next } = foldEarningsCalendar([aug, sep], "2026-08-10");
    expect(next["7203"]?.date).toBe("2026-08-20");
    expect(next["6758"]?.date).toBe("2026-09-05");
  });

  it("同一銘柄に複数の未来予定がある場合、最も近い日付を選ぶ", () => {
    const aug = makeMonth("2026-08-01", [{ date: "2026-08-25", codes: [{ code: "7203" }] }]);
    const sep = makeMonth("2026-08-01", [{ date: "2026-09-01", codes: [{ code: "7203" }] }]);
    const { next } = foldEarningsCalendar([aug, sep], "2026-08-10");
    expect(next["7203"]?.date).toBe("2026-08-25");
  });

  it("null（取得失敗した月）は無視する", () => {
    const aug = makeMonth("2026-08-01", [{ date: "2026-08-25", codes: [{ code: "7203" }] }]);
    const { next } = foldEarningsCalendar([null, aug, null], "2026-08-10");
    expect(next["7203"]?.date).toBe("2026-08-25");
  });

  it("today より前の予定は last に入り、最も新しい過去日を選ぶ（区分・発表状況つき）", () => {
    const jul = makeMonth("2026-08-01", [
      { date: "2026-07-10", codes: [{ code: "7203", announcementType: "4Q", publishStatus: "発表済" }] },
    ]);
    const aug = makeMonth("2026-08-01", [
      { date: "2026-08-05", codes: [{ code: "7203", announcementType: "1Q", publishStatus: "発表済" }] },
    ]);
    const { last } = foldEarningsCalendar([jul, aug], "2026-08-10");
    expect(last["7203"]).toEqual({ date: "2026-08-05", announcementType: "1Q", publishStatus: "発表済" });
  });

  it("過去3ヶ月にまたがる場合でも、最も新しい過去決算を選ぶ", () => {
    const may = makeMonth("2026-08-01", [
      { date: "2026-05-12", codes: [{ code: "4063", announcementType: "4Q", publishStatus: "発表済" }] },
    ]);
    const jun = makeMonth("2026-08-01", [
      { date: "2026-06-01", codes: [{ code: "9999", announcementType: "1Q", publishStatus: "発表済" }] },
    ]);
    const jul = makeMonth("2026-08-01", [
      { date: "2026-07-24", codes: [{ code: "4063", announcementType: "1Q", publishStatus: "発表済" }] },
    ]);
    const { last } = foldEarningsCalendar([may, jun, jul], "2026-08-11");
    expect(last["4063"]).toEqual({ date: "2026-07-24", announcementType: "1Q", publishStatus: "発表済" });
    expect(last["9999"]).toEqual({ date: "2026-06-01", announcementType: "1Q", publishStatus: "発表済" });
  });

  it("コードが空文字のitemは無視する", () => {
    const month = makeMonth("2026-08-01", [{ date: "2026-08-20", codes: [{ code: "" }] }]);
    const { next } = foldEarningsCalendar([month], "2026-08-10");
    expect(Object.keys(next)).toHaveLength(0);
  });

  describe("同日の発表状況（publish_status）による振り分け", () => {
    it("today と同日で publish_status='発表済' なら last に入る（next には入らない）", () => {
      const month = makeMonth("2026-08-01", [
        { date: "2026-08-10", codes: [{ code: "7203", publishStatus: "発表済" }] },
      ]);
      const { next, last } = foldEarningsCalendar([month], "2026-08-10");
      expect(next["7203"]).toBeUndefined();
      expect(last["7203"]).toEqual({ date: "2026-08-10", announcementType: "本決算", publishStatus: "発表済" });
    });

    it("today と同日で publish_status='予定'（未発表）なら next に入る（last には入らない）", () => {
      const month = makeMonth("2026-08-01", [
        { date: "2026-08-10", codes: [{ code: "7203", publishStatus: "予定" }] },
      ]);
      const { next, last } = foldEarningsCalendar([month], "2026-08-10");
      expect(next["7203"]?.date).toBe("2026-08-10");
      expect(last["7203"]).toBeUndefined();
    });
  });

  describe("codesFilter", () => {
    it("codesFilter を渡すと、含まれない銘柄コードは next/last どちらにも出さない", () => {
      const month = makeMonth("2026-08-01", [
        { date: "2026-08-20", codes: [{ code: "7203" }, { code: "6758" }] },
        { date: "2026-08-05", codes: [{ code: "9999" }] },
      ]);
      const { next, last } = foldEarningsCalendar([month], "2026-08-10", new Set(["7203"]));
      expect(Object.keys(next)).toEqual(["7203"]);
      expect(Object.keys(last)).toHaveLength(0);
    });

    it("codesFilter が未指定なら全銘柄を対象にする（後方互換）", () => {
      const month = makeMonth("2026-08-01", [{ date: "2026-08-20", codes: [{ code: "7203" }] }]);
      const { next } = foldEarningsCalendar([month], "2026-08-10");
      expect(next["7203"]).toBeDefined();
    });
  });
});
