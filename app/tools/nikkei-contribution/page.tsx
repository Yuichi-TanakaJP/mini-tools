import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadContributionDayData, loadContributionManifest } from "./data-loader";
import type { NikkeiContributionPageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";

export const metadata: Metadata = {
  title: "日経225寄与度 | mini-tools",
  description:
    "日経225の寄与度を日付ごとに確認できるツール。上昇・下落寄与ランキング、全銘柄テーブル、影響度マップをまとめて見られます。",
  alternates: {
    canonical: "/tools/nikkei-contribution",
  },
};

async function loadData(): Promise<NikkeiContributionPageData> {
  const [manifest, holidays] = await Promise.all([
    loadContributionManifest(),
    loadJpxMarketClosedData(),
  ]);

  const visibleDates = manifest.dates;
  const initialDayData = visibleDates[0] ? await loadContributionDayData(visibleDates[0]) : null;
  const filteredDates = visibleDates;

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
