import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadThemeDetail } from "../data-loader";
import { ThemeDetailView } from "../ThemeViewer";

export const metadata: Metadata = {
  title: "テーマ詳細 | mini-tools premium",
  description: "stock-notesに保存したテーマの見立て・根拠・taxonomy・metrics・actionを読み取り専用で確認します。",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PremiumThemeDetailPage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent(`/premium/themes/${themeId}`)}`);
  }

  const result = await loadThemeDetail(themeId);
  return <ThemeDetailView result={result} />;
}
