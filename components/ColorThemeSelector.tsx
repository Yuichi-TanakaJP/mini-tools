"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  COLOR_THEME_STORAGE_KEY,
  type ColorThemePreference,
  isColorThemePreference,
  resolveColorTheme,
} from "@/lib/color-theme";

const THEME_OPTIONS: Array<{ value: ColorThemePreference; label: string }> = [
  { value: "system", label: "端末設定" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

const preferenceListeners = new Set<() => void>();
let volatilePreference: ColorThemePreference | null = null;

function getPreferenceSnapshot(): ColorThemePreference {
  try {
    const saved = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return isColorThemePreference(saved) ? saved : volatilePreference ?? "system";
  } catch {
    return volatilePreference ?? "system";
  }
}

function getPreferenceServerSnapshot(): ColorThemePreference {
  return "system";
}

function subscribePreference(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COLOR_THEME_STORAGE_KEY) onStoreChange();
  };

  preferenceListeners.add(onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    preferenceListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function savePreference(preference: ColorThemePreference) {
  volatilePreference = preference;
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, preference);
  } catch {
    // 保存できない環境でも、このタブ内では選択を反映する。
  }
  preferenceListeners.forEach((listener) => listener());
}

function applyColorTheme(preference: ColorThemePreference) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveColorTheme(preference, systemPrefersDark);
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  const themeColor = resolved === "dark" ? "#0d1117" : "#eef2f7";
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", themeColor));
}

export default function ColorThemeSelector() {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );

  useEffect(() => {
    applyColorTheme(preference);
    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => applyColorTheme("system");
    mediaQuery.addEventListener("change", onSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", onSystemThemeChange);
  }, [preference]);

  const onChange = (nextPreference: ColorThemePreference) => {
    applyColorTheme(nextPreference);
    savePreference(nextPreference);
  };

  return (
    <label className="color-theme-selector">
      <svg
        className="color-theme-selector__icon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
      </svg>
      <span className="color-theme-selector__label">表示</span>
      <select
        value={preference}
        onChange={(event) => onChange(event.target.value as ColorThemePreference)}
        aria-label="表示テーマ"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <style>{`
        .color-theme-selector {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 7px 0 9px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 9px;
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.82);
        }

        .color-theme-selector__icon {
          flex: 0 0 auto;
        }

        .color-theme-selector__label {
          font-size: 11px;
          font-weight: 800;
        }

        .color-theme-selector select {
          min-width: 72px;
          border: 0;
          outline: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .color-theme-selector select:focus-visible {
          outline: 2px solid #6ea8fe;
          outline-offset: 2px;
          border-radius: 4px;
        }

        .color-theme-selector option {
          background: #161b22;
          color: #e6edf3;
        }

        @media (max-width: 640px) {
          .color-theme-selector {
            padding-left: 7px;
            gap: 4px;
          }

          .color-theme-selector__label {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          .color-theme-selector select {
            min-width: 58px;
            max-width: 58px;
          }
        }

        @media (max-width: 420px) {
          .color-theme-selector__icon {
            display: none;
          }

          .color-theme-selector select {
            min-width: 54px;
            max-width: 54px;
          }
        }
      `}</style>
    </label>
  );
}
