"use client";

import dynamic from "next/dynamic";
import type { RadarView, RangeDays } from "./logic";
import type { DisclosureEventsPageData } from "./types";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly({
  data,
  initialView,
  initialRange,
  initialEventId,
}: {
  data: DisclosureEventsPageData | null;
  initialView: RadarView;
  initialRange: RangeDays;
  initialEventId?: string;
}) {
  return (
    <ToolClient
      data={data}
      initialView={initialView}
      initialRange={initialRange}
      initialEventId={initialEventId}
    />
  );
}
