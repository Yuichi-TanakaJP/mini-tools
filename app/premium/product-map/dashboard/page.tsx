import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import ProductPortfolioCockpit from "./ProductPortfolioCockpit";

export const metadata: Metadata = {
  title: "Development Portfolio | mini-tools",
  description: "複数の個人開発Productを、状態・重要度・運用先・接続の観点から俯瞰して次の判断につなげます。",
  alternates: { canonical: "/premium/product-map/dashboard" },
  robots: { index: false, follow: false },
};

export default async function WorkspaceDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/product-map/dashboard")}`);
  }

  return <ProductPortfolioCockpit />;
}
