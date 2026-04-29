import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type {
  EconCalendarWeeklyResponse,
  EconCalendarMeta,
  EconCalendarPageData,
} from "./types";

const REVALIDATE = 3600;

async function loadWeekly(): Promise<EconCalendarWeeklyResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    return await fetchJson<EconCalendarWeeklyResponse>(`${apiBase}/econ-calendar/weekly`, REVALIDATE);
  } catch {
    return null;
  }
}

async function loadMeta(): Promise<EconCalendarMeta | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;
  try {
    return await fetchJson<EconCalendarMeta>(`${apiBase}/econ-calendar/weekly/meta`, REVALIDATE);
  } catch {
    return null;
  }
}

export async function loadEconCalendarPageData(): Promise<EconCalendarPageData> {
  const [weekly, meta] = await Promise.all([loadWeekly(), loadMeta()]);
  return { weekly, meta };
}
