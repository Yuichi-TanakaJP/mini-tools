import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadMonthlyYutaiPageData } from "./data-loader";

export const metadata: Metadata = {
  title: "優待カレンダー | mini-tools",
  description:
    "権利確定月ごとに優待銘柄を一覧表示し、気になる銘柄をピックして優待メモへ追加できます。",
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
