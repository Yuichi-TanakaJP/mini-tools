import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ToolClient from "./ToolClient";
import {
  ALL_MONTHS_ID,
  loadMonthlyYutaiAllMonthsPageData,
  loadMonthlyYutaiPageData,
} from "@/app/tools/yutai-candidates/data-loader";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { getYutaiDashboardPath } from "@/lib/premium-navigation";
import {
  getCalendarDaysForBusinessDays,
  getUpcomingKenriInfoByMonth,
} from "@/app/tools/_shared/yutai-kenri-date";
import {
  BUY_TO_GENBIKI_BUSINESS_DAYS,
  KENRI_TO_RETURN_BUSINESS_DAYS,
} from "@/app/tools/_shared/yutai-cross-fee";

/** JST の今日の年・月・日を返す */
function getJstToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
    month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "0"),
  };
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "優待ダッシュボード | mini-tools",
  description:
    "優待候補の発掘（ピック・パス・メモ追加）と、仕込み時期・クロス戦略・取得実績の管理を PC 向けの一覧テーブルで行えます。",
  alternates: {
    canonical: "/tools/yutai-dashboard",
  },
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    const dashboardPath = getYutaiDashboardPath(params?.month);
    redirect(`/premium/login?next=${encodeURIComponent(dashboardPath)}`);
  }

  const data = params?.month === ALL_MONTHS_ID
    ? await loadMonthlyYutaiAllMonthsPageData()
    : await loadMonthlyYutaiPageData(params?.month);
  // 権利月ごとの権利付最終日・返却日（現渡し受渡日）・今日→返却日の暦日数（貸株料日数に使う）
  const today = getJstToday();
  const kenriInfoByMonth = getUpcomingKenriInfoByMonth(today, KENRI_TO_RETURN_BUSINESS_DAYS);
  // 制度信用買い→現引きまでの暦日数（買方金利の日数）
  const buyInterestDays = getCalendarDaysForBusinessDays(today, BUY_TO_GENBIKI_BUSINESS_DAYS);
  return (
    <ToolClient
      data={data}
      kenriInfoByMonth={kenriInfoByMonth}
      buyInterestDays={buyInterestDays}
    />
  );
}
