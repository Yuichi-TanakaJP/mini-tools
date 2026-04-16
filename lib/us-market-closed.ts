import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { JpxMarketClosedResponse } from "@/lib/market-calendar-types";

export async function loadUsMarketClosedData(): Promise<JpxMarketClosedResponse | null> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return null;
  }

  try {
    return await fetchJson<JpxMarketClosedResponse>(`${apiBase}/market-calendar/us-closed`);
  } catch {
    return null;
  }
}
