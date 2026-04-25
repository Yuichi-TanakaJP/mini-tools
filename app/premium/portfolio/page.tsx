import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PortfolioDashboard from "./PortfolioDashboard";
import { sampleEvents, sampleHoldings } from "./sample-data";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

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

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

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
            Premium Preview
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

        <PortfolioDashboard holdings={sampleHoldings} events={sampleEvents} today={today} />
      </section>
    </main>
  );
}
