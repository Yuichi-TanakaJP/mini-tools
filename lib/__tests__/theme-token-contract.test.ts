import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const THEME_SPECIFIC_TOKENS = [
  "--color-bg",
  "--color-bg-card",
  "--color-bg-input",
  "--color-bg-subtle",
  "--color-bg-elevated",
  "--color-bg-overlay",
  "--color-text",
  "--color-text-sub",
  "--color-text-muted",
  "--color-text-inverse",
  "--color-border",
  "--color-border-strong",
  "--color-border-accent",
  "--color-focus-ring",
  "--color-accent",
  "--color-accent-sub",
  "--color-accent-hover",
  "--color-accent-highlight",
  "--color-accent-text",
  "--color-accent-glow",
  "--color-info",
  "--color-info-bg",
  "--color-info-text",
  "--color-info-border",
  "--color-error",
  "--color-error-bg",
  "--color-error-text",
  "--color-error-border",
  "--color-success",
  "--color-success-bg",
  "--color-success-text",
  "--color-success-border",
  "--color-warning",
  "--color-warning-bg",
  "--color-warning-text",
  "--color-warning-border",
  "--color-neutral-bg",
  "--color-neutral-text",
  "--color-neutral-border",
  "--color-rise",
  "--color-rise-bg",
  "--color-rise-border",
  "--color-fall",
  "--color-fall-bg",
  "--color-fall-border",
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
  "--color-chart-6",
  "--shadow-card",
  "--shadow-card-hover",
  "--shadow-panel",
] as const;

function selectorBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  const bodyStart = css.indexOf("{", start) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

function declaredTokens(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
  );
}

describe("global theme token contract", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
  const lightTokens = declaredTokens(selectorBody(css, ":root"));
  const darkTokens = declaredTokens(selectorBody(css, 'html[data-theme="dark"]'));

  it.each(THEME_SPECIFIC_TOKENS)("defines %s for Light and Dark", (token) => {
    expect(lightTokens.has(token)).toBe(true);
    expect(darkTokens.has(token)).toBe(true);
  });

  it("keeps the legacy danger name as an alias during migration", () => {
    expect(lightTokens.has("--color-danger")).toBe(true);
    expect(darkTokens.has("--color-danger")).toBe(true);
  });
});
