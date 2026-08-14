import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortfolioWorkspace from "./PortfolioWorkspace";
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
  if (isSyncConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    portfolio = user ? await loadPortfolio(supabase) : portfolioAuthRequired();
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

        <PortfolioWorkspace data={portfolio} />
      </section>
    </main>
  );
}
