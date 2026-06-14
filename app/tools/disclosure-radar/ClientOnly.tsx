"use client";

import dynamic from "next/dynamic";
import type { RadarView, RangeDays } from "./logic";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly({
  initialView,
  initialRange,
  initialEventId,
}: {
  initialView: RadarView;
  initialRange: RangeDays;
  initialEventId?: string;
}) {
  return (
    <ToolClient
      initialView={initialView}
      initialRange={initialRange}
      initialEventId={initialEventId}
    />
  );
}
