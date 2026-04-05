import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JpxMarketClosedResponse } from "@/app/tools/earnings-calendar/types";

const LOCAL_HOLIDAY_DATA_PATH =
  "app/tools/earnings-calendar/data/jpx_market_closed_20260101_to_20271231.json";

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

async function loadLocalJpxMarketClosedData(): Promise<JpxMarketClosedResponse | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), LOCAL_HOLIDAY_DATA_PATH), "utf-8");
    return JSON.parse(raw) as JpxMarketClosedResponse;
  } catch {
    return null;
  }
}

export async function loadJpxMarketClosedData(): Promise<JpxMarketClosedResponse | null> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalJpxMarketClosedData();
  }

  try {
    return await fetchJson<JpxMarketClosedResponse>(`${apiBase}/market-calendar/jpx-closed`);
  } catch {
    return loadLocalJpxMarketClosedData();
  }
}
