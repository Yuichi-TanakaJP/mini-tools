import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CompanyGroupExposureCard from "./CompanyGroupExposureCard";
import PortfolioWorkspace from "./PortfolioWorkspace";
import { emptyCompanyGroupExposure, loadCompanyGroupExposure } from "./company-group-exposure";
import { loadPortfolio, portfolioAuthRequired } from "./data";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portfolio Dashboard | mini-tools premium",
  description: "保有銘柄に合わせて確認項目を集約する premium 向けダッシュボードです。",
  alternates: {
    canonical: "/premium/portfolio",
  },
};

export default async function PremiumPortfolioPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/portfolio")}`);
  }

  let portfolio = portfolioAuthRequired();
  let companyGroupExposure = emptyCompanyGroupExposure();
  let companyGroupExposureError: string | null = null;

  if (isSyncConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      portfolio = await loadPortfolio(supabase);
      try {
        companyGroupExposure = await loadCompanyGroupExposure(supabase, portfolio.currentSnapshot?.id ?? null);
      } catch (error) {
        console.error("Failed to load company group exposure", error);
        companyGroupExposureError = "企業関係データの取得に失敗しました。ポートフォリオ本体の表示は継続しています。";
      }
    }
  }

  return (
    <main style={{ padding: "28px 16px 72px" }}>
      <section style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/premium"
            style={{
              color: "var(--color-text-sub)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ← Premium ホーム
          </Link>
          <Link
            href="/tools/yutai-memo"
            style={{
              color: "var(--color-text-sub)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            優待銘柄メモ
          </Link>
        </nav>

        {portfolio.authState === "authenticated" && portfolio.currentSnapshot ? (
          <CompanyGroupExposureCard
            exposure={companyGroupExposure}
            asOf={portfolio.currentSnapshot.asOf}
            errorMessage={companyGroupExposureError}
          />
        ) : null}

        <PortfolioWorkspace data={portfolio} />
      </section>
    </main>
  );
}
