import type { Metadata } from "next";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "決算カレンダー | mini-tools",
  description:
    "日本株の決算予定を日付ベースで確認できる決算カレンダー。market_info データを使った表示を想定したデザイン確認用モックです。",
  alternates: {
    canonical: "/tools/earnings-calendar",
  },
};

export default function Page() {
  return <ToolClient />;
}
