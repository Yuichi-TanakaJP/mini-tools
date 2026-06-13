import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";
import { loadDisclosureEvents } from "./data-loader";
import type { RadarView } from "./logic";

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
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const initialView: RadarView = view === "my-stocks" ? "my-stocks" : "yutai";
  const data = await loadDisclosureEvents();

  return <ClientOnly data={data} initialView={initialView} />;
}
