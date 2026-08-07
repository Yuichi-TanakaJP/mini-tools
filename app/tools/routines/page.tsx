import type { Metadata } from "next";
import RoutinesView from "./RoutinesView";

export const metadata: Metadata = {
  title: "ルーティン一覧 | mini-tools",
  description:
    "自動・半自動・手動で回している定期作業を、週間タイムテーブルと月次一覧で棚卸しします。",
  alternates: {
    canonical: "/tools/routines",
  },
  // 個人の作業内容の棚卸しなので検索対象にはしない。
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <RoutinesView />;
}
