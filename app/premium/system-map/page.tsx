import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import SystemMapClient from "./SystemMapClient";

export const metadata: Metadata = {
  title: "System Context Map | mini-tools",
  description: "User・AI・Product・Execution・DataのAs-Isと、手動介入・制約・AI改善余地を読み取り専用で確認します。",
  alternates: { canonical: "/premium/system-map" },
  robots: { index: false, follow: false },
};

export default async function SystemMapPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/system-map")}`);
  }

  return <SystemMapClient />;
}
