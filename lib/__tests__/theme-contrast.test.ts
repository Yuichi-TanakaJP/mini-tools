import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * テーマトークンのコントラストを固定する。
 * 値は OKLCH の明度から生成しているため、明度を動かすと本文や境界線が
 * 読めなくなることがある。ここで最低ラインを機械的に守る。
 * 基準は docs/specs/cross-cutting/ui-design-concept.md の
 * 「本文 4.5:1 / 大きな文字・主要UI境界 3:1」に合わせる。
 */

const BODY = 4.5;
const UI = 3;
/** 面として見分けがつく最低比。チップが背後の面に溶けないことだけを見る */
const SURFACE = 1.05;
/** 役割の違う色が混ざらない最低距離（Oklab の dE） */
const ROLE_GAP = 0.045;

/** [前景トークン, 背景トークン, 必要比, (半透明なら合成する下地)] */
const PAIRS: ReadonlyArray<
  readonly [string, string, number] | readonly [string, string, number, string]
> = [
  ["--color-text", "--color-bg-card", BODY],
  ["--color-text", "--color-bg-input", BODY],
  ["--color-text-sub", "--color-bg-card", BODY],
  ["--color-text-muted", "--color-bg-card", BODY],
  ["--color-text-muted", "--color-bg", BODY],
  ["--color-text-muted", "--color-bg-input", BODY],
  ["--color-text-muted", "--color-bg-subtle", BODY],
  ["--color-text-muted", "--color-bg-elevated", BODY],
  ["--color-text-on-emphasis", "--color-bg-emphasis", BODY],
  ["--color-accent", "--color-bg-card", BODY],
  ["--color-accent", "--color-bg", BODY],
  ["--color-accent", "--color-accent-sub", BODY],
  ["--color-accent-hover", "--color-bg-card", BODY],
  ["--color-accent-text", "--color-accent", BODY],
  ["--color-neutral-text", "--color-neutral-bg", BODY],
  // ヘッダーは半透明なので、いちばん明るい下地（白）に重なった最悪ケースで見る
  ["--color-header-text", "--color-header-bg", BODY, "#ffffff"],
  ["--color-header-muted", "--color-header-bg", BODY, "#ffffff"],
  ["--color-info-text", "--color-info-bg", BODY],
  ["--color-success-text", "--color-success-bg", BODY],
  ["--color-warning-text", "--color-warning-bg", BODY],
  ["--color-error-text", "--color-error-bg", BODY],
  ["--color-rise", "--color-rise-bg", BODY],
  ["--color-fall", "--color-fall-bg", BODY],
  // 操作可能な部品の輪郭と、面上の状態色・グラフ系列は 3:1
  ["--color-border-control", "--color-bg-card", UI],
  ["--color-border-control", "--color-bg-input", UI],
  ["--color-border-control", "--color-bg", UI],
  ["--color-info", "--color-bg-card", UI],
  ["--color-success", "--color-bg-card", UI],
  ["--color-warning", "--color-bg-card", UI],
  ["--color-error", "--color-bg-card", UI],
  ["--color-rise", "--color-bg-card", UI],
  ["--color-fall", "--color-bg-card", UI],
  ["--color-chart-1", "--color-bg-card", UI],
  ["--color-chart-2", "--color-bg-card", UI],
  ["--color-chart-3", "--color-bg-card", UI],
  ["--color-chart-4", "--color-bg-card", UI],
  ["--color-chart-5", "--color-bg-card", UI],
  ["--color-chart-6", "--color-bg-card", UI],
  ["--color-chart-7", "--color-bg-card", UI],
  ["--color-chart-8", "--color-bg-card", UI],
  ["--color-chart-9", "--color-bg-card", UI],
  ["--color-chart-10", "--color-bg-card", UI],
  ["--color-chart-11", "--color-bg-card", UI],
  ["--color-chart-12", "--color-bg-card", UI],
  // severity は順序尺度。1・2 は「弱い」ことを示すので 3:1 を求めない
  ["--color-severity-3", "--color-bg-card", UI],
  ["--color-severity-4", "--color-bg-card", UI],
  ["--color-severity-5", "--color-bg-card", UI],
  // neutral チップが背後の面に溶けない
  ["--color-neutral-bg", "--color-bg-card", SURFACE],
  ["--color-neutral-bg", "--color-bg", SURFACE],
];

/**
 * 役割の違う色どうしが同じ色に見えないことを保つ。
 * 明度比では色相の違いを測れない（同じ明度なら必ず 1.0 付近になる）ので、
 * ここだけ Oklab 上の距離で見る。
 */
const DISTINCT: ReadonlyArray<readonly [string, string]> = [
  ["--color-fall", "--color-info"],
  ["--color-fall", "--color-accent"],
  ["--color-rise", "--color-error"],
  ["--color-rise", "--color-warning"],
];

function selectorBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  const bodyStart = css.indexOf("{", start) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

function tokenMap(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

/** 半透明トークンを下地に合成して不透明な hex にする */
function flatten(value: string, backdrop: string): string {
  if (value.startsWith("#")) return value;
  const parts = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!parts) throw new Error(`解釈できない色です: ${value}`);
  const [r, g, b, a = 1] = parts[1].split(",").map((n) => Number.parseFloat(n));
  const base = rgb(backdrop);
  const mix = (fg: number, bg: number) => Math.round(fg * a + bg * (1 - a));
  return (
    "#" +
    [mix(r, base[0]), mix(g, base[1]), mix(b, base[2])]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`hex 以外の値は扱えません: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB を Oklab へ。色相の違いを測るために使う */
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(channel);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function colorDistance(a: string, b: string): number {
  const x = oklab(a);
  const y = oklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Oklab の彩度。順序尺度の「強さ」は輝度比ではなくここに出る */
function chroma(hex: string): number {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b);
}

describe("theme contrast", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
  const light = tokenMap(selectorBody(css, ":root"));
  const dark = new Map([
    ...light,
    ...tokenMap(selectorBody(css, 'html[data-theme="dark"]')),
  ]);

  for (const [themeName, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    describe(themeName, () => {
      it.each(PAIRS)(
        "%s on %s meets %s:1",
        (fgToken, bgToken, required, backdrop = "#ffffff") => {
          const fg = tokens.get(fgToken);
          const bg = tokens.get(bgToken);
          expect(fg, `${fgToken} が未定義`).toBeDefined();
          expect(bg, `${bgToken} が未定義`).toBeDefined();
          // 背景をまず下地に合成し、前景はその合成済みの面の上に重ねる
          const surface = flatten(bg as string, backdrop);
          expect(
            contrast(flatten(fg as string, surface), surface),
          ).toBeGreaterThanOrEqual(required);
        },
      );

      // severity は順序尺度。強さは輝度比ではなく彩度で伝わるため、
      // 「1 -> 5 で彩度が単調に上がる」ことと「隣どうしが見分けられる」ことを見る。
      it("severity は 1 から 5 へ単調に強くなる", () => {
        const steps = [1, 2, 3, 4, 5].map(
          (i) => tokens.get(`--color-severity-${i}`) as string,
        );
        for (const step of steps) expect(step).toBeDefined();
        for (let i = 1; i < steps.length; i += 1) {
          expect(chroma(steps[i])).toBeGreaterThan(chroma(steps[i - 1]));
          expect(colorDistance(steps[i], steps[i - 1])).toBeGreaterThanOrEqual(
            0.03,
          );
        }
      });

      it.each(DISTINCT)("%s and %s stay distinguishable", (a, b) => {
        const first = tokens.get(a);
        const second = tokens.get(b);
        expect(first, `${a} が未定義`).toBeDefined();
        expect(second, `${b} が未定義`).toBeDefined();
        expect(
          colorDistance(first as string, second as string),
        ).toBeGreaterThanOrEqual(ROLE_GAP);
      });
    });
  }
});
