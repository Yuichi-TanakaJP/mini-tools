import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadRankingDayData, loadRankingManifest } from "./data-loader";
import type { RankingPageData } from "./types";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";
import { filterVisibleTradingDates } from "@/app/tools/_shared/market-trading-dates";

export const metadata: Metadata = {
  title: "株価ランキング | mini-tools",
  description:
    "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングを日付別に確認できるツール。",
  alternates: {
    canonical: "/tools/stock-ranking",
  },
};

async function loadData(): Promise<RankingPageData> {
  const [manifest, holidays] = await Promise.all([
    loadRankingManifest(),
    loadJpxMarketClosedData(),
  ]);

  if (!manifest) {
    return { manifest: null, initialDayData: null };
  }

  const visibleDates = filterVisibleTradingDates(manifest.dates, holidays);
  const latest = visibleDates[0] ?? manifest.latest;
  const initialDayData = latest ? await loadRankingDayData(latest) : null;

  return {
    manifest: {
      ...manifest,
      dates: visibleDates,
      latest,
    },
    initialDayData,
  };
}

export default async function Page() {
  const data = await loadData();

  if (!data.manifest) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 64px" }}>
        <section style={{ padding: "32px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>📊</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
              株価ランキング
            </h1>
          </div>
        </section>
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: 14,
          }}
        >
          データを取得できませんでした。時間をおいて再度お試しください。
        </div>
      </main>
    );
  }

  return <ToolClient manifest={data.manifest} initialDayData={data.initialDayData} />;
}
