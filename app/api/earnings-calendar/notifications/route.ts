import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  canUseLocalMarketDataFallback,
  fetchJson,
  getApiBaseUrl,
} from "@/lib/market-api";
import type {
  EarningsCalendarItem,
  EarningsCalendarManifest,
  EarningsCalendarResponse,
  OverseasEarningsCalendarItem,
  OverseasEarningsCalendarResponse,
} from "@/app/tools/earnings-calendar/types";

const CACHE_CONTROL = "public, max-age=300";
const TARGET_DAYS = 2;

type EarningsNotificationMarket = {
  count: number;
  items: EarningsCalendarItem[];
};

type EarningsNotificationDay = {
  date: string;
  domestic: EarningsNotificationMarket;
  overseas: EarningsNotificationMarket;
};

function getDataDir() {
  return path.join(process.cwd(), "app/tools/earnings-calendar/data");
}

function todayJstKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function loadLocalDomesticManifest(): Promise<EarningsCalendarManifest | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
    return JSON.parse(raw) as EarningsCalendarManifest;
  } catch {
    return null;
  }
}

async function loadLocalDomesticMonthData(
  monthId: string,
): Promise<EarningsCalendarResponse | null> {
  const manifest = await loadLocalDomesticManifest();
  const entry = manifest?.months.find((month) => month.id === monthId);
  if (!entry) return null;

  try {
    const raw = await readFile(path.join(getDataDir(), entry.path), "utf-8");
    return JSON.parse(raw) as EarningsCalendarResponse;
  } catch {
    return null;
  }
}

async function loadApiDomesticMonthData(
  monthId: string,
): Promise<EarningsCalendarResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<EarningsCalendarResponse>(
      `${apiBase}/earnings-calendar/domestic/monthly/${monthId}`,
    );
  } catch {
    return null;
  }
}

function normalizeOverseasItem(item: OverseasEarningsCalendarItem): EarningsCalendarItem {
  return {
    event_id: item.event_id,
    time: item.local_time ?? "",
    code: item.ticker ?? "",
    name: item.stock_name ?? "",
    market: item.exchange_code ?? item.country_code ?? "",
    announcement_type: item.fiscal_term_name ?? item.fiscal_term ?? "",
    publish_status: item.sch_flg === "1" ? "予定" : "発表予定",
    progress_status: item.country_code ?? "",
  };
}

function normalizeOverseasResponse(
  response: OverseasEarningsCalendarResponse,
): EarningsCalendarResponse {
  return {
    as_of_date: response.as_of_date,
    calendar: response.calendar.map((day) => ({
      date: day.date,
      count: day.count,
      detail_status: day.detail_status,
      items: day.items.map(normalizeOverseasItem),
    })),
  };
}

async function loadApiOverseasMonthData(
  monthId: string,
): Promise<EarningsCalendarResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    const raw = await fetchJson<OverseasEarningsCalendarResponse>(
      `${apiBase}/earnings-calendar/overseas/monthly/${monthId}`,
    );
    return normalizeOverseasResponse(raw);
  } catch {
    return null;
  }
}

async function loadDomesticMonthData(
  monthId: string,
): Promise<EarningsCalendarResponse | null> {
  const apiData = await loadApiDomesticMonthData(monthId);
  if (apiData) return apiData;
  return canUseLocalMarketDataFallback() ? loadLocalDomesticMonthData(monthId) : null;
}

function buildMarket(
  monthData: Record<string, EarningsCalendarResponse | null>,
  date: string,
): EarningsNotificationMarket {
  const monthId = date.slice(0, 7);
  const day = monthData[monthId]?.calendar.find((candidate) => candidate.date === date);
  return {
    count: day?.count ?? 0,
    items: day?.items ?? [],
  };
}

export async function GET() {
  const today = todayJstKey();
  const dates = Array.from({ length: TARGET_DAYS }, (_, index) => addDays(today, index));
  const monthIds = Array.from(new Set(dates.map((date) => date.slice(0, 7))));
  const [domesticEntries, overseasEntries] = await Promise.all([
    Promise.all(
      monthIds.map(async (monthId) => [monthId, await loadDomesticMonthData(monthId)] as const),
    ),
    Promise.all(
      monthIds.map(async (monthId) => [monthId, await loadApiOverseasMonthData(monthId)] as const),
    ),
  ]);
  const domesticMonthData = Object.fromEntries(domesticEntries);
  const overseasMonthData = Object.fromEntries(overseasEntries);
  const days: EarningsNotificationDay[] = dates.map((date) => ({
    date,
    domestic: buildMarket(domesticMonthData, date),
    overseas: buildMarket(overseasMonthData, date),
  }));

  return NextResponse.json(
    {
      schema_version: "earnings-calendar-home-notifications-v1",
      generated_at: new Date().toISOString(),
      days,
    },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}