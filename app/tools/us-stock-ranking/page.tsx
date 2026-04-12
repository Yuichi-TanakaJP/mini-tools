import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadUsRankingManifest, loadUsRankingDayData } from "./data-loader";
import type { UsRankingPageData } from "./types";

export const metadata: Metadata = {
  title: "米国株ランキング | mini-tools",
  description:
    "米国株の値上がり率・値下がり率・売買代金ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/us-stock-ranking",
  },
};

async function loadData(): Promise<UsRankingPageData> {
  const manifest = await loadUsRankingManifest();
  if (!manifest) {
    return { manifest: null, initialDayData: null };
  }

  const latest = manifest.latest;
  const initialDayData = latest ? await loadUsRankingDayData(latest) : null;

  return { manifest, initialDayData };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
