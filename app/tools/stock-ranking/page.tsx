import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadRankingDayData, loadRankingManifest } from "./data-loader";
import type { JpxMarketClosedResponse, RankingPageData } from "./types";

export const metadata: Metadata = {
  title: "株価ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/stock-ranking",
  },
};

function getDayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekendDate(dateStr: string) {
  const day = getDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

function getStockRankingBaseUrls() {
  const baseUrl = process.env.STOCK_RANKING_DATA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!baseUrl) {
    return [];
  }

  return baseUrl.endsWith("/stock-ranking") ? [baseUrl] : [baseUrl, `${baseUrl}/stock-ranking`];
}

async function fetchHolidayJson(url: string): Promise<JpxMarketClosedResponse> {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  return (await res.json()) as JpxMarketClosedResponse;
}

async function loadHolidayData(): Promise<JpxMarketClosedResponse | null> {
  const baseUrls = getStockRankingBaseUrls();
  const remoteCandidates = baseUrls.flatMap((baseUrl) =>
    baseUrl.endsWith("/stock-ranking")
      ? [`${baseUrl.slice(0, -"/stock-ranking".length)}/earnings-calendar`]
      : [`${baseUrl}/earnings-calendar`, baseUrl],
  );

  for (const candidate of remoteCandidates) {
    try {
      return await fetchHolidayJson(`${candidate}/jpx_market_closed_20260101_to_20271231.json`);
    } catch {
      continue;
    }
  }

  try {
    const holidayPath = path.join(
      process.cwd(),
      "app/tools/earnings-calendar/data/jpx_market_closed_20260101_to_20271231.json",
    );
    const holidayRaw = await readFile(holidayPath, "utf-8");
    return JSON.parse(holidayRaw) as JpxMarketClosedResponse;
  } catch {
    return null;
  }
}

async function loadData(): Promise<RankingPageData> {
  const manifest = await loadRankingManifest();
  const holidays = await loadHolidayData();

  const holidayMap = new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  const visibleDates = manifest.dates.filter((date) => {
    if (holidayMap.get(date)?.market_closed) {
      return false;
    }

    return !isWeekendDate(date);
  });
  const latest = visibleDates[0] ?? manifest.latest;
  const initialDayData = latest ? await loadRankingDayData(latest) : null;

  return {
    manifest: {
      ...manifest,
      dates: visibleDates,
      latest,
    },
    initialDayData,
  };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
