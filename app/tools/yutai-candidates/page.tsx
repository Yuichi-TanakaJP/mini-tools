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

type PageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const data = await loadMonthlyYutaiPageData(params?.month);
  return <ToolClient data={data} />;
}
