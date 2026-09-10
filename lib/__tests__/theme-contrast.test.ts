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

/** [前景トークン, 背景トークン, 必要比] */
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ["--color-text", "--color-bg-card", BODY],
  ["--color-text", "--color-bg-input", BODY],
  ["--color-text-sub", "--color-bg-card", BODY],
  ["--color-text-muted", "--color-bg-card", BODY],
  ["--color-text-muted", "--color-bg", BODY],
  ["--color-text-muted", "--color-bg-input", BODY],
  ["--color-text-muted", "--color-bg-subtle", BODY],
  ["--color-text-muted", "--color-bg-elevated", BODY],
  ["--color-accent", "--color-bg-card", BODY],
  ["--color-accent", "--color-bg", BODY],
  ["--color-accent", "--color-accent-sub", BODY],
  ["--color-accent-hover", "--color-bg-card", BODY],
  ["--color-accent-text", "--color-accent", BODY],
  ["--color-neutral-text", "--color-neutral-bg", BODY],
  ["--color-header-text", "--color-header-bg", BODY],
  ["--color-header-muted", "--color-header-bg", BODY],
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

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`hex 以外の値はコントラスト検証できません: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
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
      it.each(PAIRS)("%s on %s meets %s:1", (fgToken, bgToken, required) => {
        const fg = tokens.get(fgToken);
        const bg = tokens.get(bgToken);
        expect(fg, `${fgToken} が未定義`).toBeDefined();
        expect(bg, `${bgToken} が未定義`).toBeDefined();
        expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(
          required,
        );
      });
    });
  }
});
