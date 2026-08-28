import { describe, expect, it } from "vitest";
import {
  IDENTITY_VIEWPORT,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  isIdentity,
  panBy,
  toTransform,
  zoomAt,
} from "./use-pan-zoom";

describe("clampScale", () => {
  it("上限と下限で頭打ちにする", () => {
    expect(clampScale(100)).toBe(MAX_SCALE);
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(2)).toBe(2);
  });

  it("有限でない値は等倍へ戻す", () => {
    // 計算が壊れたときに上限へ飛ばすより、初期状態へ戻すほうが安全。
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("zoomAt", () => {
  /** 中身の座標 p が画面上のどこに来るか。 */
  const project = (viewport: { scale: number; x: number; y: number }, p: number) =>
    viewport.scale * p + viewport.x;

  it("指定した点の位置を保ったまま拡大する", () => {
    const zoomed = zoomAt(IDENTITY_VIEWPORT, 2, 120, -40);
    expect(zoomed.scale).toBe(2);
    // 等倍のとき、画面座標 120 に来ている中身は p = 120。拡大後も 120 のまま。
    expect(project(zoomed, 120)).toBeCloseTo(120);
  });

  it("縮小でも固定点がずれない", () => {
    const zoomed = zoomAt({ scale: 4, x: 30, y: -10 }, 0.5, -200, 60);
    const p = (-200 - 30) / 4;
    expect(zoomed.scale).toBe(2);
    expect(project(zoomed, p)).toBeCloseTo(-200);
  });

  it("上限に達したら倍率を超えず、位置も実際の倍率に合わせる", () => {
    const zoomed = zoomAt({ scale: MAX_SCALE, x: 0, y: 0 }, 4, 50, 50);
    expect(zoomed.scale).toBe(MAX_SCALE);
    expect(zoomed.x).toBeCloseTo(0);
    expect(zoomed.y).toBeCloseTo(0);
  });

  it("拡大と同じ倍率の縮小で元へ戻る", () => {
    const zoomed = zoomAt(IDENTITY_VIEWPORT, 3, 77, -12);
    const back = zoomAt(zoomed, 1 / 3, 77, -12);
    expect(back.scale).toBeCloseTo(1);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
  });
});

describe("panBy", () => {
  it("倍率を変えずに平行移動する", () => {
    expect(panBy({ scale: 2, x: 10, y: -5 }, 4, 6)).toEqual({ scale: 2, x: 14, y: 1 });
  });
});

describe("isIdentity / toTransform", () => {
  it("初期状態を判定する", () => {
    expect(isIdentity(IDENTITY_VIEWPORT)).toBe(true);
    expect(isIdentity({ scale: 1, x: 1, y: 0 })).toBe(false);
    expect(isIdentity({ scale: 1.2, x: 0, y: 0 })).toBe(false);
  });

  it("SVG の transform 文字列にする", () => {
    expect(toTransform({ scale: 2, x: 3, y: -4 })).toBe("translate(3 -4) scale(2)");
  });
});
