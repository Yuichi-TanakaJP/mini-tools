import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadTopix33DayData, loadTopix33Manifest } from "./data-loader";
import type { Topix33PageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";

export const metadata: Metadata = {
  title: "TOPIX33業種 | mini-tools",
  description:
    "TOPIX33業種の騰落を日付ごとに確認できるツール。上昇・下落業種ランキング、全33業種一覧をまとめて見られます。",
  alternates: {
    canonical: "/tools/topix33",
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

async function loadData(): Promise<Topix33PageData> {
  const [manifest, holidays] = await Promise.all([
    loadTopix33Manifest(),
    loadJpxMarketClosedData(),
  ]);

  const holidayMap = new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  const visibleDates = manifest.dates.filter((date) => {
    if (holidayMap.get(date)?.market_closed) {
      return false;
    }
    return !isWeekendDate(date);
  });

  let initialDayData = null;

  for (const date of visibleDates) {
    const dayData = await loadTopix33DayData(date);
    if (dayData && dayData.sectors.length > 0) {
      initialDayData = dayData;
      break;
    }
  }

  const filteredManifest = {
    ...manifest,
    dates: visibleDates,
    latest_date: visibleDates[0] ?? null,
  };

  return { manifest: filteredManifest, initialDayData, holidays };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
