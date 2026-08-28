import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CompanyNetworkClient from "./CompanyNetworkClient";
import {
  companyNetworkAuthRequired,
  companyNetworkUnconfigured,
  loadCompanyNetworkBootstrap,
} from "./data-loader";
import type { CompanyNetworkBootstrapResult } from "./types";

export const metadata: Metadata = {
  title: "企業関係マップ | mini-tools premium",
  description:
    "企業間の資本・支配・歴史的関係と、財閥・企業グループ所属を根拠付きで可視化します。",
  alternates: {
    canonical: "/premium/company-network",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PremiumCompanyNetworkPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/company-network")}`);
  }

  let result: CompanyNetworkBootstrapResult = companyNetworkUnconfigured();
  if (isSyncConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    result = user ? await loadCompanyNetworkBootstrap(supabase) : companyNetworkAuthRequired();
  }

  return <CompanyNetworkClient result={result} />;
}
