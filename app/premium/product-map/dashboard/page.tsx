import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import WorkspaceDashboardClient from "./WorkspaceDashboardClient";

export const metadata: Metadata = {
  title: "Workspace Dashboard | mini-tools",
  description: "Workspace CoreのProduct・Repository・Technology・Provider・Relationを横断的に一覧します。",
  alternates: { canonical: "/premium/product-map/dashboard" },
  robots: { index: false, follow: false },
};

export default async function WorkspaceDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/product-map/dashboard")}`);
  }

  return <WorkspaceDashboardClient />;
}
