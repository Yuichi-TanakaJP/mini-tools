import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadInvestorFlowPageData } from "./data-loader";

export const metadata: Metadata = {
  title: "投資主体別売買動向 | mini-tools",
  description:
    "JPX公式データ由来の投資主体別売買動向を、海外投資家・個人・法人などのカテゴリ別に週次で確認できます。",
  alternates: {
    canonical: "/tools/investor-flow",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const data = await loadInvestorFlowPageData(start, end);

  return <ToolClient data={data} />;
}
