import { describe, expect, it } from "vitest";
import {
  COLOR_THEME_STORAGE_KEY,
  createColorThemeInitScript,
  isColorThemePreference,
  resolveColorTheme,
} from "../color-theme";

describe("color theme preference", () => {
  it("accepts only supported preference values", () => {
    expect(isColorThemePreference("system")).toBe(true);
    expect(isColorThemePreference("light")).toBe(true);
    expect(isColorThemePreference("dark")).toBe(true);
    expect(isColorThemePreference("midnight")).toBe(false);
    expect(isColorThemePreference(null)).toBe(false);
  });

  it("resolves the system preference while preserving explicit choices", () => {
    expect(resolveColorTheme("system", true)).toBe("dark");
    expect(resolveColorTheme("system", false)).toBe("light");
    expect(resolveColorTheme("light", true)).toBe("light");
    expect(resolveColorTheme("dark", false)).toBe("dark");
  });

  it("builds an early initialization script with the shared storage key", () => {
    const script = createColorThemeInitScript();
    expect(script).toContain(COLOR_THEME_STORAGE_KEY);
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("document.documentElement.dataset.theme");
    expect(script).toContain('meta[name="theme-color"]');
  });
});
