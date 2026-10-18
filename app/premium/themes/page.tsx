import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadThemeListPage } from "./data-loader";
import ThemeListSession from "./ThemeListSession";
import { themeListHref } from "./navigation";

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

export default async function PremiumThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { cursor } = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent(themeListHref(cursor))}`);
  }

  const result = await loadThemeListPage(cursor);
  return <ThemeListSession result={result} isContinuation={cursor !== undefined} cursor={typeof cursor === "string" && themeListHref(cursor).includes("?") ? cursor : undefined} />;
}
