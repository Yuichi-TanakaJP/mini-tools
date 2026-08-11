import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "銘柄分析ダッシュボード | mini-tools",
  description:
    "stock-notes（カスタムGPT）に記録した銘柄分析・見立て・アクションを一覧で確認。保有しているのに分析が無い銘柄をトップに表示する読み取り専用ツール。ログインが必要です。",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/tools/stock-notes",
  },
};

export default function Page() {
  return <ClientOnly />;
}
