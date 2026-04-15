import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { JpxMarketClosedResponse } from "@/lib/market-calendar-types";

const LOCAL_HOLIDAY_DATA_PATH =
  "app/tools/earnings-calendar/data/jpx_market_closed_20260101_to_20271231.json";

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
