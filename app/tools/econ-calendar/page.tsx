import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadEconCalendarPageData } from "./data-loader";

export const metadata: Metadata = {
  title: "経済指標カレンダー | mini-tools",
  description:
    "今週の経済指標を日付・時刻・重要度別に確認。impact フィルタで重要指標に絞り込み、前回・予想・結果を一覧で確認できます。",
  alternates: {
    canonical: "/tools/econ-calendar",
  },
};

export default async function Page() {
  const data = await loadEconCalendarPageData();
  return <ToolClient data={data} />;
}
