import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadTdnetDisclosures } from "./data-loader";

export const metadata: Metadata = {
  title: "TDNET適時開示一覧 | mini-tools",
  description:
    "TDNETの適時開示を日付ごとに確認できるツール。銘柄コード・会社名・タイトル検索、財務関連や決算短信の絞り込みに対応。",
  alternates: {
    canonical: "/tools/tdnet-disclosures",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; range?: string }>;
}) {
  const { date, range } = await searchParams;
  const data = await loadTdnetDisclosures(date, range);

  return (
    <ToolClient
      key={`${date ?? data?.target_date ?? "latest"}-${range ?? "1"}`}
      data={data}
      requestedDate={date}
      requestedRange={range}
    />
  );
}
