"use client";

import dynamic from "next/dynamic";
import type { RadarView } from "./logic";
import type { DisclosureEventsResponse } from "./types";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly({
  data,
  initialView,
}: {
  data: DisclosureEventsResponse | null;
  initialView: RadarView;
}) {
  return <ToolClient data={data} initialView={initialView} />;
}
