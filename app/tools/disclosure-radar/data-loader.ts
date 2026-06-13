import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type { DisclosureEventsResponse } from "./types";

export async function loadDisclosureEvents(): Promise<DisclosureEventsResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<DisclosureEventsResponse>(
      `${apiBase}/disclosure-events/latest`,
      300,
    );
  } catch {
    return null;
  }
}
