import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import RoutinesView from "./RoutinesView";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const metadata: Metadata = {
  title: "ルーティン一覧 | mini-tools premium",
  description:
    "自動・半自動・手動で回している定期作業を、週間タイムテーブルと月次一覧で棚卸しします。",
  alternates: {
    canonical: "/premium/routines",
  },
  // 個人の作業内容の棚卸しなので検索対象にはしない。
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/routines")}`);
  }

  return <RoutinesView />;
}
