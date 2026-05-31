import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";
import { loadMyStocksReference } from "./data-loader";

export const metadata: Metadata = {
  title: "マイ銘柄リスト | mini-tools",
  description:
    "保有銘柄と気になる銘柄（ウォッチ）を端末内に保存できる無料ツール。決算予定日や優待権利確定月のバッジも表示。データはブラウザ内に保存され、サーバーには送信しません。",
  alternates: {
    canonical: "/tools/my-stocks",
  },
};

export default async function Page() {
  const reference = await loadMyStocksReference();
  return <ClientOnly reference={reference} />;
}
