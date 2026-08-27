import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import IndustryMapClient from "./IndustryMapClient";
import { industryMapAuthRequired, industryMapUnconfigured, loadIndustryMap } from "./data-loader";
import type { IndustryMapLoadResult } from "./types";

export const metadata: Metadata = {
  title: "業界マップ | mini-tools premium",
  description:
    "Supabaseに保存した産業構造・企業経済圏マップを、階層・放射・ネットワーク・マトリクス・表の5表現で確認します。",
  alternates: {
    canonical: "/premium/industry-map",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PremiumIndustryMapPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/industry-map")}`);
  }

  let result: IndustryMapLoadResult = industryMapUnconfigured();
  if (isSyncConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    result = user ? await loadIndustryMap(supabase) : industryMapAuthRequired();
  }

  return <IndustryMapClient result={result} />;
}
