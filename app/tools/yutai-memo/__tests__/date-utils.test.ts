import { describe, expect, it } from "vitest";
import { getPreparationMonth, isPreparationMonth, resolveEntitlementMonthKey } from "../date-utils";

describe("getPreparationMonth", () => {
  it("権利月から指定月数を引く", () => {
    expect(getPreparationMonth(9, 3)).toBe(6);
    expect(getPreparationMonth(9, 0)).toBe(9);
  });

  it("年をまたぐ仕込み月を求める", () => {
    expect(getPreparationMonth(2, 3)).toBe(11);
  });

  it("不正な値は null にする", () => {
    expect(getPreparationMonth(13, 1)).toBeNull();
    expect(getPreparationMonth(3, 12)).toBeNull();
  });
});

describe("isPreparationMonth", () => {
  it("複数権利月のいずれかが対象なら true", () => {
    expect(isPreparationMonth([3, 9], 3, 6)).toBe(true);
    expect(isPreparationMonth([3, 9], 3, 7)).toBe(false);
  });

  it("仕込み時期が未設定なら false", () => {
    expect(isPreparationMonth([9], undefined, 6)).toBe(false);
  });
});

describe("resolveEntitlementMonthKey", () => {
  const iso = (year: number, month: number, day = 15) =>
    `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}T00:00:00+09:00`;

  it("prep 未指定は従来どおり取得日以前の直近の権利月に紐づく", () => {
    // 5月権利、6月取得 → 当年5月
    expect(resolveEntitlementMonthKey([5], iso(2026, 6))).toBe("2026-05");
    // 5月権利、2月取得（prep 情報なし）→ 前年5月（従来動作）
    expect(resolveEntitlementMonthKey([5], iso(2026, 2))).toBe("2025-05");
  });

  it("リード期間中（仕込み開始〜権利月）の取得は当年の権利月に寄せる", () => {
    // 5月権利・3か月前仕込み（仕込み開始2月）、2月取得 → 当年5月
    expect(resolveEntitlementMonthKey([5], iso(2026, 2), 3)).toBe("2026-05");
    // 4月取得（リード内）→ 当年5月
    expect(resolveEntitlementMonthKey([5], iso(2026, 4), 3)).toBe("2026-05");
  });

  it("リード開始より前の取得は前年の権利月のまま", () => {
    // 5月権利・3か月前（開始2月）、1月取得 → 前年5月
    expect(resolveEntitlementMonthKey([5], iso(2026, 1), 3)).toBe("2025-05");
  });

  it("権利確定後の取得は当年の権利月に紐づく", () => {
    // 5月権利・3か月前、6月取得 → 当年5月
    expect(resolveEntitlementMonthKey([5], iso(2026, 6), 3)).toBe("2026-05");
  });

  it("年をまたぐリード（2月権利・3か月前=前年11月開始）を扱う", () => {
    // 11月取得（翌2月権利のリード内）→ 翌年2月
    expect(resolveEntitlementMonthKey([2], iso(2025, 11), 3)).toBe("2026-02");
    // 2月取得 → 当年2月
    expect(resolveEntitlementMonthKey([2], iso(2026, 2), 3)).toBe("2026-02");
  });

  it("複数権利月ではリードに入る直近の権利へ寄せる", () => {
    // 2月・8月権利・3か月前、6月取得（8月のリード5〜8月内）→ 当年8月
    expect(resolveEntitlementMonthKey([2, 8], iso(2026, 6), 3)).toBe("2026-08");
  });
});
