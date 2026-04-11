import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import {
  loadMarketRankingManifest,
  loadMarketRankingMonthData,
} from "./data-loader";
import type { MarketRankingPageData, MarketRankingType } from "./types";

export const metadata: Metadata = {
  title: "市場ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場ごとに、時価総額ランキングと配当利回りランキングを月次で確認できます。",
  alternates: {
    canonical: "/tools/market-rankings",
  },
};

type PageProps = {
  searchParams?: Promise<{
    type?: string;
    month?: string;
  }>;
};

function normalizeRankingType(value?: string): MarketRankingType {
  return value === "dividend-yield" ? "dividend-yield" : "market-cap";
}

async function loadData(
  requestedType?: string,
  requestedMonth?: string,
): Promise<MarketRankingPageData> {
  const rankingType = normalizeRankingType(requestedType);
  const manifest = await loadMarketRankingManifest(rankingType);
  const selectedMonth =
    requestedMonth && manifest?.months.includes(requestedMonth)
      ? requestedMonth
      : manifest?.latest ?? "";
  const initialMonthData = selectedMonth
    ? await loadMarketRankingMonthData(rankingType, selectedMonth)
    : null;
  const monthDataFailed = Boolean(selectedMonth) && initialMonthData === null;

  return {
    rankingType,
    manifest,
    selectedMonth,
    initialMonthData,
    monthDataFailed,
  };
}

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const data = await loadData(params?.type, params?.month);
  return <ToolClient data={data} />;
}
