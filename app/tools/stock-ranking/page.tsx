import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import type { RankingManifest, RankingDayData, RankingPageData } from "./types";

export const metadata: Metadata = {
  title: "株価ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/stock-ranking",
  },
};

async function loadData(): Promise<RankingPageData> {
  const dataDir = path.join(process.cwd(), "app/tools/stock-ranking/data");

  const manifest: RankingManifest = JSON.parse(
    await readFile(path.join(dataDir, "manifest.json"), "utf-8"),
  );

  const dayData: Record<string, RankingDayData> = {};
  for (const dateStr of manifest.dates) {
    const fileKey = dateStr.replace(/-/g, "");
    try {
      const raw = await readFile(path.join(dataDir, `${fileKey}.json`), "utf-8");
      dayData[dateStr] = JSON.parse(raw) as RankingDayData;
    } catch {
      // ファイルが欠損していればスキップ
    }
  }

  return { manifest, dayData };
}

export default async function Page() {
  const data = await loadData();
  return <ToolClient data={data} />;
}
