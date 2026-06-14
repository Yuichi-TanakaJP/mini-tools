import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";
import { loadDisclosureEvents } from "./data-loader";
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
  const data = await loadDisclosureEvents();
  const targetEvent = data?.items.find((item) => item.event_id === event);
  const requestedView: RadarView = view === "my-stocks" ? "my-stocks" : "yutai";
  const initialView: RadarView = targetEvent
    ? targetEvent.audience === "all"
      ? "yutai"
      : "my-stocks"
    : requestedView;
  const requestedRange: RangeDays =
    range === "1" || range === "30" ? Number(range) as RangeDays : 7;
  const ageInDays = targetEvent && data
    ? Math.floor(
        (Date.parse(`${data.referenceDate}T00:00:00Z`) -
          Date.parse(`${targetEvent.disclosure_date}T00:00:00Z`)) /
          86_400_000,
      ) + 1
    : 0;
  const eventRange: RangeDays =
    ageInDays <= 1 ? 1 : ageInDays <= 7 ? 7 : 30;
  const initialRange: RangeDays = targetEvent
    ? Math.max(requestedRange, eventRange) as RangeDays
    : requestedRange;

  return (
    <ClientOnly
      data={data}
      initialView={initialView}
      initialRange={initialRange}
      initialEventId={event}
    />
  );
}
