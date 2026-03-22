import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import type { EarningsCalendarResponse } from "./types";

export const metadata: Metadata = {
  title: "決算カレンダー | mini-tools",
  description:
    "日本株の決算予定を日付ベースで確認できる決算カレンダー。market_info の整形データをもとに、月間カレンダーと日別一覧で見やすく表示します。",
  alternates: {
    canonical: "/tools/earnings-calendar",
  },
};

async function loadCalendarData(): Promise<EarningsCalendarResponse> {
  const filePath = path.join(process.cwd(), "app/tools/earnings-calendar/data/latest.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as EarningsCalendarResponse;
}

export default async function Page() {
  const data = await loadCalendarData();
  return <ToolClient data={data} />;
}
