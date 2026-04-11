import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadTopix33DayData, loadTopix33Manifest } from "./data-loader";
import type { Topix33PageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";
import {
  filterVisibleTradingDates,
  findFirstUsableDayData,
} from "@/app/tools/_shared/market-trading-dates";

export const metadata: Metadata = {
  title: "TOPIX33業種 | mini-tools",
  description:
    "TOPIX33業種の騰落を日付ごとに確認できるツール。上昇・下落業種ランキング、全33業種一覧をまとめて見られます。",
  alternates: {
    canonical: "/tools/topix33",
  },
};

async function loadData(): Promise<Topix33PageData> {
  const [manifest, holidays] = await Promise.all([
    loadTopix33Manifest(),
    loadJpxMarketClosedData(),
  ]);

  const visibleDates = filterVisibleTradingDates(manifest.dates, holidays);
  const { matched } = await findFirstUsableDayData(
    visibleDates,
    loadTopix33DayData,
    (dayData): dayData is NonNullable<Topix33PageData["initialDayData"]> =>
      !!dayData && dayData.sectors.length > 0,
  );
  const initialDayData = matched?.dayData ?? null;

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
