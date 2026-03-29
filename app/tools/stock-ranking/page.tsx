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

async function loadData(): Promise<RankingPageData> {
  const manifest = await loadRankingManifest();
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
