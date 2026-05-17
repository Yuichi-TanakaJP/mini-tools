import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type { TdnetDisclosureListResponse } from "./types";

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeRangeDays(value?: string): number {
  if (value === "7") return 7;
  if (value === "30") return 30;
  return 1;
}

async function fetchTdnetDate(
  apiBase: string,
  date: string,
): Promise<TdnetDisclosureListResponse | null> {
  try {
    return await fetchJson<TdnetDisclosureListResponse>(`${apiBase}/tdnet/disclosures/${date}`);
  } catch {
    return null;
  }
}

export async function loadTdnetDisclosures(
  date?: string,
  range?: string,
): Promise<TdnetDisclosureListResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  const normalizedDate = date?.trim();
  const rangeDays = normalizeRangeDays(range);

  try {
    const baseData = normalizedDate && isDateString(normalizedDate)
      ? await fetchTdnetDate(apiBase, normalizedDate)
      : await fetchJson<TdnetDisclosureListResponse>(`${apiBase}/tdnet/disclosures/latest`);

    if (!baseData || rangeDays === 1) {
      return baseData ? { ...baseData, range_days: 1, loaded_dates: [baseData.target_date] } : null;
    }

    const dates = Array.from({ length: rangeDays }, (_, idx) => addDays(baseData.target_date, -idx));
    const extraDates = dates.slice(1);
    const extraResponses = await Promise.all(extraDates.map((targetDate) => fetchTdnetDate(apiBase, targetDate)));
    const responses = [baseData, ...extraResponses.filter((item): item is TdnetDisclosureListResponse => Boolean(item))];
    const items = responses
      .flatMap((response) => response.items)
      .sort((a, b) => {
        const dateOrder = b.disclosure_date.localeCompare(a.disclosure_date);
        if (dateOrder !== 0) return dateOrder;
        return b.disclosure_time.localeCompare(a.disclosure_time);
      });

    return {
      ...baseData,
      total_count: responses.reduce((sum, response) => sum + response.total_count, 0),
      items,
      range_days: rangeDays,
      loaded_dates: responses.map((response) => response.target_date),
    };
  } catch {
    return null;
  }
}
