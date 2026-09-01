import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import ProductMapClient from "./ProductMapClient";

export const metadata: Metadata = {
  title: "Product Map | mini-tools",
  description: "Workspace Coreに登録したProduct・Repository・Technology・Service・依存関係を俯瞰します。",
  alternates: { canonical: "/premium/product-map" },
  robots: { index: false, follow: false },
};

export default async function ProductMapPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/product-map")}`);
  }

  return <ProductMapClient />;
}
