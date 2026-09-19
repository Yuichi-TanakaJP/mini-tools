export const SEARCH_PRESETS_KEY = "tdnet_disclosures_search_presets_v1";

export function loadSearchPresets(): unknown[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SEARCH_PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchPresets(presets: unknown): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(SEARCH_PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}
