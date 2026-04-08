import type { JpxMarketClosedResponse } from "@/app/tools/earnings-calendar/types";

function getApiBaseUrl() {
  return process.env.MARKET_INFO_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
