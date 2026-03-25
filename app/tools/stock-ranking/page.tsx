import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadRankingDayData, loadRankingManifest } from "./data-loader";
import type { RankingPageData } from "./types";

export const metadata: Metadata = {
  title: "株価ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/stock-ranking",
  },
};

async function loadData(): Promise<RankingPageData> {
  const manifest = await loadRankingManifest();
  const initialDayData = await loadRankingDayData(manifest.latest);

  return { manifest, initialDayData };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
