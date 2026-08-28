import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ThemeCompanyNetworkClient from "./ThemeCompanyNetworkClient";
import {
  loadThemeCompanyNetwork,
  themeCompanyNetworkAuthRequired,
  themeCompanyNetworkUnconfigured,
  type ThemeCompanyNetworkLoadResult,
} from "./data-loader";

export const metadata: Metadata = {
  title: "テーマ × 企業関係 | mini-tools premium",
  description: "テーマへの直接企業と、資本・支配・歴史的関係で見つかる企業を根拠付きで分離表示します。",
  alternates: { canonical: "/premium/theme-company-network" },
  robots: { index: false, follow: false },
};

export default async function PremiumThemeCompanyNetworkPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/theme-company-network")}`);
  }

  let result: ThemeCompanyNetworkLoadResult = themeCompanyNetworkUnconfigured();
  if (isSyncConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    result = user ? await loadThemeCompanyNetwork(supabase) : themeCompanyNetworkAuthRequired();
  }

  return <ThemeCompanyNetworkClient result={result} />;
}
