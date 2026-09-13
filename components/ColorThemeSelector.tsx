"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
}

function ThemeIcon({ preference }: { preference: ColorThemePreference }) {
  if (preference === "light") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (preference === "dark") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M12 7a3.5 3.5 0 0 0 0 7Z" />
    </svg>
  );
}

export default function ColorThemeSelector() {
  const preference = useSyncExternalStore(subscribePreference, getPreferenceSnapshot, getPreferenceServerSnapshot);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyColorTheme(preference);
    if (preference !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => applyColorTheme("system");
    mediaQuery.addEventListener("change", onSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", onSystemThemeChange);
  }, [preference]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onChange = (nextPreference: ColorThemePreference) => {
    applyColorTheme(nextPreference);
    savePreference(nextPreference);
    setOpen(false);
  };
  const currentLabel = THEME_OPTIONS.find((option) => option.value === preference)?.label ?? "端末設定";

  return (
    <div className="color-theme-selector" ref={rootRef}>
      <button
        type="button"
        className="color-theme-selector__trigger"
        aria-label={`表示テーマ: ${currentLabel}`}
        aria-expanded={open}
        title={`表示テーマ: ${currentLabel}`}
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon preference={preference} />
      </button>
      {open ? (
        <div className="color-theme-selector__menu" role="group" aria-label="表示テーマを選択">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preference === option.value}
              aria-label={option.label}
              title={option.label}
              className={`color-theme-selector__option ${preference === option.value ? "is-active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <ThemeIcon preference={option.value} />
            </button>
          ))}
        </div>
      ) : null}
      <style>{`
        .color-theme-selector { position: relative; }
        .color-theme-selector__trigger,
        .color-theme-selector__option {
          display: grid;
          place-items: center;
          border: 1px solid var(--color-header-border);
          color: var(--color-header-text);
          cursor: pointer;
        }
        .color-theme-selector__trigger {
          width: 36px;
          height: 36px;
          padding: 0;
          border-radius: 10px;
          background: var(--color-header-control);
        }
        .color-theme-selector__menu {
          position: absolute;
          z-index: 50;
          top: calc(100% + 10px);
          right: 0;
          display: flex;
          gap: 6px;
          padding: 7px;
          border: 1px solid var(--color-border-strong);
          border-radius: 13px;
          background: var(--color-bg-elevated);
          box-shadow: var(--shadow-panel);
        }
        .color-theme-selector__option {
          width: 38px;
          height: 38px;
          padding: 0;
          border-radius: 9px;
          border-color: transparent;
          background: transparent;
          color: var(--color-text-sub);
        }
        .color-theme-selector__option.is-active {
          border-color: var(--color-border-accent);
          background: var(--color-accent-sub);
          color: var(--color-accent);
        }
        .color-theme-selector__trigger:focus-visible,
        .color-theme-selector__option:focus-visible {
          outline: 2px solid var(--color-accent-highlight);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
