import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadThemeList } from "./data-loader";
import { ThemeListView } from "./ThemeViewer";

export const metadata: Metadata = {
  title: "テーマViewer | mini-tools premium",
  description: "stock-notesに保存したテーマの概要・履歴・根拠・関連を読み取り専用で確認します。",
  alternates: {
    canonical: "/premium/themes",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PremiumThemesPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/themes")}`);
  }

  const result = await loadThemeList();
  return <ThemeListView result={result} />;
}
