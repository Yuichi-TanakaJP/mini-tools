import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadContributionDayData, loadContributionManifest } from "./data-loader";
import type { NikkeiContributionPageData } from "./types";

export const metadata: Metadata = {
  title: "日経225寄与度 | mini-tools",
  description:
    "日経225の寄与度を日付ごとに確認できるツール。上昇・下落寄与ランキング、全銘柄テーブル、影響度マップをまとめて見られます。",
  alternates: {
    canonical: "/tools/nikkei-contribution",
  },
};

async function loadData(): Promise<NikkeiContributionPageData> {
  const manifest = await loadContributionManifest();
  const initialDayData = manifest.latest_date ? await loadContributionDayData(manifest.latest_date) : null;

  return { manifest, initialDayData };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
