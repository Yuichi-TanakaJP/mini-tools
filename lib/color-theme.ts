export const COLOR_THEME_STORAGE_KEY = "mini_tools_color_theme_v1";

export const COLOR_THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ColorThemePreference = (typeof COLOR_THEME_PREFERENCES)[number];
export type ResolvedColorTheme = Exclude<ColorThemePreference, "system">;

export function isColorThemePreference(value: unknown): value is ColorThemePreference {
  return COLOR_THEME_PREFERENCES.includes(value as ColorThemePreference);
}

export function resolveColorTheme(
  preference: ColorThemePreference,
  systemPrefersDark: boolean,
): ResolvedColorTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function createColorThemeInitScript(): string {
  return `(() => {
    const apply = (resolved) => {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      const themeColor = resolved === "dark" ? "#0d1117" : "#eef2f7";
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute("content", themeColor);
      });
    };
    try {
      const saved = localStorage.getItem(${JSON.stringify(COLOR_THEME_STORAGE_KEY)});
      const preference = saved === "light" || saved === "dark" ? saved : "system";
      const resolved = preference === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
      apply(resolved);
    } catch {
      const resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      apply(resolved);
    }
  })();`;
}
