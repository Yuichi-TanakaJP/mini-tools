// app/tools/yutai-memo/page.tsx
import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "優待銘柄メモ帳 | mini-tools",
  description:
    "株主優待の銘柄メモ、タグ、権利月、長期条件、失敗ログ、関連リンクを端末内で管理できる優待メモツールです。",
  alternates: {
    canonical: "/tools/yutai-memo",
  },
};

export default function Page() {
  return <ClientOnly />;
}


