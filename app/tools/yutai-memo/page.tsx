// app/tools/yutai-memo/page.tsx
import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";
import { loadNikkoShortBalance } from "./data-loader";

export const metadata: Metadata = {
  title: "優待銘柄メモ帳 | mini-tools",
  description:
    "株主優待の銘柄メモ、タグ、権利月、長期条件、失敗ログ、関連リンクを端末内で管理できる優待メモツールです。",
  alternates: {
    canonical: "/tools/yutai-memo",
  },
};

export default async function Page() {
  // 日興の信用売り残高（公開 JSON）をサーバ側で読み、クライアントへ渡す。
  // クライアントが自分のメモ銘柄コードで filter して表示する。
  const shortBalance = await loadNikkoShortBalance();
  return (
    <>
      <ClientOnly shortBalance={shortBalance} />
    </>
  );
}


