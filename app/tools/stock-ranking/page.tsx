import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadRankingDayData, loadRankingManifest } from "./data-loader";
import type { RankingPageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";
import { filterVisibleTradingDates } from "@/app/tools/_shared/market-trading-dates";

export const metadata: Metadata = {
  title: "株価ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/stock-ranking",
  },
};

async function loadData(): Promise<RankingPageData> {
  const [manifest, holidays] = await Promise.all([
    loadRankingManifest(),
    loadJpxMarketClosedData(),
  ]);

  if (!manifest) {
    return { manifest: null, initialDayData: null };
  }

  const visibleDates = filterVisibleTradingDates(manifest.dates, holidays);
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
