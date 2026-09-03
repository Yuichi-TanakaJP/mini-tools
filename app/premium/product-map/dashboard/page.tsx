import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import ProductPortfolioCockpit from "./ProductPortfolioCockpit";

export const metadata: Metadata = {
  title: "Service & Product Portfolio | mini-tools",
  description: "複数Productの組み合わせが誰にどんな価値をどんな形で届けるかをService単位で可視化し、Productと実装へ掘り下げます。",
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
