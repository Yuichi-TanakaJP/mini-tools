import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";
import type { RadarView, RangeDays } from "./logic";

export const metadata: Metadata = {
  title: "開示イベントレーダー | mini-tools",
  description:
    "全銘柄の株主優待変更と、マイ銘柄の配当・業績修正・自社株買いなどを確認できます。",
  alternates: {
    canonical: "/tools/disclosure-radar",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string; event?: string }>;
}) {
  const { view, range, event } = await searchParams;
  const requestedView: RadarView = view === "my-stocks" ? "my-stocks" : "yutai";
  const requestedRange: RangeDays =
    range === "1" || range === "30" ? Number(range) as RangeDays : 7;

  return (
    <ClientOnly
      initialView={requestedView}
      initialRange={requestedRange}
      initialEventId={event}
    />
  );
}
