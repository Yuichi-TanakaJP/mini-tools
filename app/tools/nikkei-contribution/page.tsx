import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadContributionDayData, loadContributionManifest } from "./data-loader";
import type { JpxMarketClosedResponse, NikkeiContributionPageData } from "./types";

export const metadata: Metadata = {
  title: "日経225寄与度 | mini-tools",
  description:
    "日経225の寄与度を日付ごとに確認できるツール。上昇・下落寄与ランキング、全銘柄テーブル、影響度マップをまとめて見られます。",
  alternates: {
    canonical: "/tools/nikkei-contribution",
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

function isLikelyMarketClosed(dayData: NikkeiContributionPageData["initialDayData"]) {
  if (!dayData || dayData.records.length === 0) {
    return false;
  }

  return !dayData.records.some(
    (record) => record.chg !== 0 || record.chg_pct !== 0 || record.contribution !== 0,
  );
}

async function loadData(): Promise<NikkeiContributionPageData> {
  const manifest = await loadContributionManifest();
  let holidays: JpxMarketClosedResponse | null = null;

  try {
    const holidayPath = path.join(
      process.cwd(),
      "app/tools/earnings-calendar/data/jpx_market_closed_20260101_to_20271231.json",
    );
    const holidayRaw = await readFile(holidayPath, "utf-8");
    holidays = JSON.parse(holidayRaw) as JpxMarketClosedResponse;
  } catch {
    holidays = null;
  }

  const holidayMap = new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  const visibleDates = manifest.dates.filter((date) => {
    if (holidayMap.get(date)?.market_closed) {
      return false;
    }

    return !isWeekendDate(date);
  });

  let initialDayData = null;
  const excludedLeadingDates = new Set<string>();

  for (const date of visibleDates) {
    const dayData = await loadContributionDayData(date);
    if (!dayData || isLikelyMarketClosed(dayData)) {
      excludedLeadingDates.add(date);
      continue;
    }

    initialDayData = dayData;
    break;
  }

  const filteredDates = visibleDates.filter((date) => !excludedLeadingDates.has(date));
  const filteredManifest = {
    ...manifest,
    dates: filteredDates,
    latest_date: filteredDates[0] ?? null,
  };

  return { manifest: filteredManifest, initialDayData, holidays };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
