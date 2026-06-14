import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type { DisclosureEventsManifest, DisclosureEventsResponse } from "./types";

export async function loadDisclosureManifest(): Promise<DisclosureEventsManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<DisclosureEventsManifest>(
      `${apiBase}/disclosure-events/manifest`,
      300,
    );
  } catch {
    return null;
  }
}

export async function loadDisclosureEventsByDate(
  date: string,
): Promise<DisclosureEventsResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<DisclosureEventsResponse>(
      `${apiBase}/disclosure-events/${date}`,
      31_536_000,
    );
  } catch {
    return null;
  }
}
