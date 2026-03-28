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

async function loadData(): Promise<NikkeiContributionPageData> {
  const manifest = await loadContributionManifest();
  const initialDayData = manifest.latest_date ? await loadContributionDayData(manifest.latest_date) : null;
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

  return { manifest, initialDayData, holidays };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
