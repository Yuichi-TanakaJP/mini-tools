import { describe, expect, it } from "vitest";
import type { ArchivedMemoItem, MemoItem } from "@/app/tools/yutai-memo/types";
import { buildCalendarCells } from "../calendar";

const NOW_ISO = "2026-06-15T00:00:00+09:00";

function memo(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: "memo-1",
    name: "テスト銘柄",
    code: "1234",
    createdAt: NOW_ISO,
    months: [9],
    tagIds: [],
    crossType: "単発クロス",
    preparationMonthsBefore: 3,
    acquired: false,
    priority: 1,
    memo: "",
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function archive(overrides: Partial<ArchivedMemoItem> = {}): ArchivedMemoItem {
  return {
    id: "archive-1",
    memoId: "memo-1",
    code: "1234",
    name: "テスト銘柄",
    acquiredAt: "2026-06-10T00:00:00+09:00",
    entitlementMonthKey: "2026-09",
    ...overrides,
  };
}

describe("buildCalendarCells の取得（＝仕込み）表示", () => {
  it("選択年度の archive は権利月に緑✓、acquiredAt の月に仕込み実施を出す", () => {
    const cells = buildCalendarCells(memo(), [archive()], 2026, NOW_ISO);

    expect(cells[8].acquiredThisYear).toBe(true);
    expect(cells[8].acquiredYears).toEqual([2026]);
    expect(cells[5].prepCompleted).toBe(true);
  });

  it("他年度の archive は灰✓を維持し、選択年度外の仕込み実施は出さない", () => {
    const cells = buildCalendarCells(memo(), [archive()], 2027, NOW_ISO);

    expect(cells[8].acquiredThisYear).toBe(false);
    expect(cells[8].acquiredPast).toBe(true);
    expect(cells.some((cell) => cell.prepCompleted)).toBe(false);
  });

  it("現在の acquired は解決した権利月に緑✓、acquiredMarkedAt の月に仕込み実施を出す", () => {
    const cells = buildCalendarCells(
      memo({ acquired: true, acquiredMarkedAt: "2026-06-10T00:00:00+09:00" }),
      [archive({ id: "archive-old", entitlementMonthKey: "2025-09" })],
      2026,
      NOW_ISO,
    );

    expect(cells[8].acquiredThisYear).toBe(true);
    expect(cells[8].acquiredPast).toBe(true);
    expect(cells[8].acquiredYears).toEqual([2025, 2026]);
    expect(cells[5].prepCompleted).toBe(true);
  });

  it("acquiredMarkedAt がない現在の acquired は現在時刻で権利年を補完するが、仕込み実施は出さない", () => {
    const cells = buildCalendarCells(memo({ acquired: true }), [], 2026, NOW_ISO);

    expect(cells[8].acquiredThisYear).toBe(true);
    expect(cells.some((cell) => cell.prepCompleted)).toBe(false);
  });

  it("現在の acquired は別年度の表示でも灰✓として残す", () => {
    const cells = buildCalendarCells(
      memo({ acquired: true, acquiredMarkedAt: "2026-06-10T00:00:00+09:00" }),
      [],
      2027,
      NOW_ISO,
    );

    expect(cells[8].acquiredThisYear).toBe(false);
    expect(cells[8].acquiredPast).toBe(true);
    expect(cells[8].acquiredYears).toEqual([2026]);
    expect(cells.some((cell) => cell.prepCompleted)).toBe(false);
  });

  it("同じ銘柄コードでもメモの権利月と異なる archive の仕込み実施は表示しない", () => {
    const cells = buildCalendarCells(
      memo({ months: [9] }),
      [archive({ acquiredAt: "2026-03-10T00:00:00+09:00", entitlementMonthKey: "2026-06" })],
      2026,
      NOW_ISO,
    );

    expect(cells[5].entitlement).toBe(false);
    expect(cells[5].acquiredThisYear).toBe(false);
    expect(cells[2].prepCompleted).toBe(false);
  });

  it("年またぎ仕込みは選択した権利年の行で acquiredAt の実月に出す", () => {
    const cells = buildCalendarCells(
      memo({ months: [2] }),
      [archive({ acquiredAt: "2025-11-20T00:00:00+09:00", entitlementMonthKey: "2026-02" })],
      2026,
      NOW_ISO,
    );

    expect(cells[1].acquiredThisYear).toBe(true);
    expect(cells[10].prepCompleted).toBe(true);
  });
});
