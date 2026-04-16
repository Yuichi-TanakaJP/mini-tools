import { describe, expect, it, vi } from "vitest";
import {
  filterVisibleTradingDates,
  findFirstUsableDayData,
} from "../market-trading-dates";

describe("filterVisibleTradingDates", () => {
  it("週末と market_closed=true の日付を除外する", () => {
    const result = filterVisibleTradingDates(
      [
        "2025-04-04",
        "2025-04-05",
        "2025-04-06",
        "2025-04-07",
        "2025-04-08",
      ],
      {
        days: [
          { date: "2025-04-07", market_closed: true },
          { date: "2025-04-08", market_closed: false },
        ],
      },
    );

    expect(result).toEqual(["2025-04-04", "2025-04-08"]);
  });

  it("休場日データが null のときは週末だけを除外する", () => {
    const result = filterVisibleTradingDates(
      ["2025-04-11", "2025-04-12", "2025-04-13", "2025-04-14"],
      null,
    );

    expect(result).toEqual(["2025-04-11", "2025-04-14"]);
  });
});

describe("findFirstUsableDayData", () => {
  it("最初に usable な日付を返し、それ以前の失敗日を skippedDates に積む", async () => {
    const loadDayData = vi
      .fn<(_: string) => Promise<{ rows: number[] } | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [1, 2, 3] });

    const result = await findFirstUsableDayData(
      ["2025-04-10", "2025-04-09", "2025-04-08"],
      loadDayData,
      (dayData): dayData is { rows: number[] } =>
        Array.isArray(dayData?.rows) && dayData.rows.length > 0,
    );

    expect(result).toEqual({
      matched: {
        date: "2025-04-08",
        dayData: { rows: [1, 2, 3] },
      },
      skippedDates: ["2025-04-10", "2025-04-09"],
    });
    expect(loadDayData).toHaveBeenCalledTimes(3);
  });

  it("usable な日付が見つかったらそれ以降は探索しない", async () => {
    const loadDayData = vi
      .fn<(_: string) => Promise<{ ok: boolean } | null>>()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const result = await findFirstUsableDayData(
      ["2025-04-10", "2025-04-09"],
      loadDayData,
      (dayData): dayData is { ok: boolean } => dayData?.ok === true,
    );

    expect(result).toEqual({
      matched: {
        date: "2025-04-10",
        dayData: { ok: true },
      },
      skippedDates: [],
    });
    expect(loadDayData).toHaveBeenCalledTimes(1);
  });

  it("どの日付も usable でないときは matched=null と全 skippedDates を返す", async () => {
    const loadDayData = vi
      .fn<(_: string) => Promise<{ rows: number[] } | null>>()
      .mockResolvedValue(null);

    const result = await findFirstUsableDayData(
      ["2025-04-10", "2025-04-09"],
      loadDayData,
      (dayData): dayData is { rows: number[] } =>
        Array.isArray(dayData?.rows) && dayData.rows.length > 0,
    );

    expect(result).toEqual({
      matched: null,
      skippedDates: ["2025-04-10", "2025-04-09"],
    });
    expect(loadDayData).toHaveBeenCalledTimes(2);
  });

  it("候補日が空なら loadDayData を呼ばずに null を返す", async () => {
    const loadDayData = vi.fn();

    const result = await findFirstUsableDayData(
      [],
      loadDayData,
      (dayData): dayData is { ok: boolean } => dayData !== null,
    );

    expect(result).toEqual({
      matched: null,
      skippedDates: [],
    });
    expect(loadDayData).not.toHaveBeenCalled();
  });
});
