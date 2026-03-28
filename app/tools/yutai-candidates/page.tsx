import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadMonthlyYutaiPageData } from "./data-loader";

export const metadata: Metadata = {
  title: "優待候補一覧 | mini-tools",
  description:
    "market_info の月別優待データを一覧表示し、気になる銘柄をピックして優待メモへ追加できる候補探索ページです。",
  alternates: {
    canonical: "/tools/yutai-candidates",
  },
};

export default async function Page() {
  const data = await loadMonthlyYutaiPageData();
  return <ToolClient data={data} />;
}
