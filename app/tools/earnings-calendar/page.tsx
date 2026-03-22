import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import type {
  EarningsCalendarManifest,
  EarningsCalendarPageData,
  EarningsCalendarResponse,
} from "./types";

export const metadata: Metadata = {
  title: "決算カレンダー | mini-tools",
  description:
    "日本株の決算予定を日付ベースで確認できる決算カレンダー。market_info の整形データをもとに、月間カレンダーと日別一覧で見やすく表示します。",
  alternates: {
    canonical: "/tools/earnings-calendar",
  },
};

async function loadCalendarData(): Promise<EarningsCalendarPageData> {
  const dataDir = path.join(process.cwd(), "app/tools/earnings-calendar/data");
  const manifestPath = path.join(dataDir, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as EarningsCalendarManifest;

  const monthEntries = await Promise.all(
    manifest.months.map(async (entry) => {
      const raw = await readFile(path.join(dataDir, entry.path), "utf-8");
      return [entry.id, JSON.parse(raw) as EarningsCalendarResponse] as const;
    }),
  );

  return {
    manifest,
    monthData: Object.fromEntries(monthEntries),
  };
}

export default async function Page() {
  const data = await loadCalendarData();
  return <ToolClient data={data} />;
}
