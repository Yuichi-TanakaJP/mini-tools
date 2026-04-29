import { getApiBaseUrl } from "@/lib/market-api";
import type {
  EconCalendarWeeklyResponse,
  EconCalendarMeta,
  EconCalendarPageData,
} from "./types";

async function fetchEconJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadWeekly(): Promise<EconCalendarWeeklyResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    return await fetchEconJson<EconCalendarWeeklyResponse>(`${apiBase}/econ-calendar/weekly`);
  } catch {
    return null;
  }
}

async function loadMeta(): Promise<EconCalendarMeta | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    return await fetchEconJson<EconCalendarMeta>(`${apiBase}/econ-calendar/weekly/meta`);
  } catch {
    return null;
  }
}

export async function loadEconCalendarPageData(): Promise<EconCalendarPageData> {
  const [weekly, meta] = await Promise.all([loadWeekly(), loadMeta()]);
  return { weekly, meta };
}
