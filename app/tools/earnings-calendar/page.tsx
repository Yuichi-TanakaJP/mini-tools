import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadEarningsCalendarPageData } from "./data-loader";

export const metadata: Metadata = {
  title: "決算カレンダー | mini-tools",
  description:
    "国内株と海外株の決算予定を日付ベースで確認できる決算カレンダー。market_info の整形データをもとに、月間カレンダーと日別一覧で見やすく表示します。",
  alternates: {
    canonical: "/tools/earnings-calendar",
  },
};

export default async function Page() {
  const data = await loadEarningsCalendarPageData();
  return <ToolClient data={data} />;
}
