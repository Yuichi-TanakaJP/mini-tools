import { describe, expect, it } from "vitest";
import { getPreparationMonth, isPreparationMonth } from "../date-utils";

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
