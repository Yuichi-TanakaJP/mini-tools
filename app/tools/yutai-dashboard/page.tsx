import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import {
  ALL_MONTHS_ID,
  loadMonthlyYutaiAllMonthsPageData,
  loadMonthlyYutaiPageData,
} from "@/app/tools/yutai-candidates/data-loader";

export const metadata: Metadata = {
  title: "優待ダッシュボード | mini-tools",
  description:
    "優待候補の発掘（ピック・パス・メモ追加）と、仕込み時期・クロス戦略・取得実績の管理を PC 向けの一覧テーブルで行えます。",
  alternates: {
    canonical: "/tools/yutai-dashboard",
  },
};

type PageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const data = params?.month === ALL_MONTHS_ID
    ? await loadMonthlyYutaiAllMonthsPageData()
    : await loadMonthlyYutaiPageData(params?.month);
  return <ToolClient data={data} />;
}
