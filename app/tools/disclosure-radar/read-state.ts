export const READ_EVENT_IDS_STORAGE_KEY = "disclosure_radar_read_event_ids_v1";

export function loadReadEventIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_EVENT_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

export function saveReadEventIds(ids: Set<string>): void {
  try {
    localStorage.setItem(
      READ_EVENT_IDS_STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-2000)),
    );
  } catch {
    // The in-memory state remains usable when storage is unavailable.
  }
}
