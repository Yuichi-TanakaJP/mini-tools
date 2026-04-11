import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadContributionDayData, loadContributionManifest } from "./data-loader";
import type { NikkeiContributionPageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";
import {
  filterVisibleTradingDates,
  findFirstUsableDayData,
} from "@/app/tools/_shared/market-trading-dates";

export const metadata: Metadata = {
  title: "日経225寄与度 | mini-tools",
  description:
    "日経225の寄与度を日付ごとに確認できるツール。上昇・下落寄与ランキング、全銘柄テーブル、影響度マップをまとめて見られます。",
  alternates: {
    canonical: "/tools/nikkei-contribution",
  },
};

function isLikelyMarketClosed(dayData: NikkeiContributionPageData["initialDayData"]) {
  if (!dayData || dayData.records.length === 0) {
    return false;
  }

  return !dayData.records.some(
    (record) => record.chg !== 0 || record.chg_pct !== 0 || record.contribution !== 0,
  );
}

async function loadData(): Promise<NikkeiContributionPageData> {
  const [manifest, holidays] = await Promise.all([
    loadContributionManifest(),
    loadJpxMarketClosedData(),
  ]);

  const visibleDates = filterVisibleTradingDates(manifest.dates, holidays);
  const { matched, skippedDates } = await findFirstUsableDayData(
    visibleDates,
    loadContributionDayData,
    (dayData): dayData is NonNullable<NikkeiContributionPageData["initialDayData"]> =>
      !!dayData && !isLikelyMarketClosed(dayData),
  );
  const initialDayData = matched?.dayData ?? null;
  const excludedLeadingDates = new Set(skippedDates);

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
