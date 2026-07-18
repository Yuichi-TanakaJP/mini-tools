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
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/tools/yutai-dashboard")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  const data = params?.month === ALL_MONTHS_ID
    ? await loadMonthlyYutaiAllMonthsPageData()
    : await loadMonthlyYutaiPageData(params?.month);
  return <ToolClient data={data} />;
}
