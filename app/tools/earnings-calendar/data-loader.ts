import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadUsMarketClosedData } from "@/lib/us-market-closed";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type {
  EarningsCalendarManifest,
  EarningsCalendarItem,
  EarningsCalendarMarketData,
  EarningsCalendarDay,
  EarningsCalendarPageData,
  EarningsCalendarResponse,
  JpxMarketClosedResponse,
  OverseasEarningsCalendarItem,
  OverseasEarningsCalendarResponse,
} from "./types";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/earnings-calendar/data");
}


async function loadLocalDomesticManifest(): Promise<EarningsCalendarManifest> {
  const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
  return JSON.parse(raw) as EarningsCalendarManifest;
}

async function loadLocalDomesticMonthDataByPath(filePath: string): Promise<EarningsCalendarResponse> {
  const raw = await readFile(path.join(getDataDir(), filePath), "utf-8");
  return JSON.parse(raw) as EarningsCalendarResponse;
}

async function loadLocalDomesticLatest(): Promise<EarningsCalendarResponse | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "latest.json"), "utf-8");
    return JSON.parse(raw) as EarningsCalendarResponse;
  } catch {
    return null;
  }
}

async function loadLocalDomesticHolidays(): Promise<JpxMarketClosedResponse | null> {
  try {
    const raw = await readFile(
      path.join(getDataDir(), "jpx_market_closed_20260101_to_20271231.json"),
      "utf-8",
    );
    return JSON.parse(raw) as JpxMarketClosedResponse;
  } catch {
    return null;
  }
}

async function loadDomesticData(): Promise<EarningsCalendarMarketData> {
  const manifest = await loadLocalDomesticManifest();
  const monthEntries = await Promise.all(
    manifest.months.map(async (entry) => {
      const monthData = await loadLocalDomesticMonthDataByPath(entry.path);
      return [entry.id, monthData] as const;
    }),
  );
  const [latest, holidays] = await Promise.all([
    loadLocalDomesticLatest(),
    loadLocalDomesticHolidays(),
  ]);

  return {
    manifest,
    monthData: Object.fromEntries(monthEntries),
    latest,
    holidays,
  };
}

async function loadOverseasManifest(): Promise<EarningsCalendarManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<EarningsCalendarManifest>(`${apiBase}/earnings-calendar/overseas/manifest`);
  } catch {
    return null;
  }
}

async function loadOverseasLatest(): Promise<EarningsCalendarResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    const raw = await fetchJson<OverseasEarningsCalendarResponse>(`${apiBase}/earnings-calendar/overseas/latest`);
    return normalizeOverseasResponse(raw);
  } catch {
    return null;
  }
}

async function loadOverseasMonthData(yearMonth: string): Promise<EarningsCalendarResponse | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    const raw = await fetchJson<OverseasEarningsCalendarResponse>(
      `${apiBase}/earnings-calendar/overseas/monthly/${yearMonth}`,
    );
    return normalizeOverseasResponse(raw);
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

function normalizeOverseasDay(day: OverseasEarningsCalendarResponse["calendar"][number]): EarningsCalendarDay {
  return {
    date: day.date,
    count: day.count,
    detail_status: day.detail_status,
    items: day.items.map(normalizeOverseasItem),
  };
}

function normalizeOverseasResponse(response: OverseasEarningsCalendarResponse): EarningsCalendarResponse {
  return {
    as_of_date: response.as_of_date,
    calendar: response.calendar.map(normalizeOverseasDay),
  };
}

async function loadOverseasData(): Promise<EarningsCalendarMarketData> {
  const manifest = await loadOverseasManifest();
  const latest = await loadOverseasLatest();

  if (!manifest) {
    return {
      manifest: null,
      monthData: {},
      latest,
      holidays: null,
    };
  }

  const [monthEntries, holidays] = await Promise.all([
    Promise.all(
      manifest.months.map(async (entry) => {
        const monthData = await loadOverseasMonthData(entry.id);
        return monthData ? ([entry.id, monthData] as const) : null;
      }),
    ),
    loadUsMarketClosedData(),
  ]);

  return {
    manifest,
    monthData: Object.fromEntries(monthEntries.filter((entry) => entry !== null)),
    latest,
    holidays,
  };
}

export async function loadEarningsCalendarPageData(): Promise<EarningsCalendarPageData> {
  const [domestic, overseas] = await Promise.all([loadDomesticData(), loadOverseasData()]);

  return {
    domestic,
    overseas,
  };
}
