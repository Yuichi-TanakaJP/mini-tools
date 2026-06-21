import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "データ引っ越し | mini-tools",
  description:
    "各ツールの端末内データ（LocalStorage）を JSON ファイルに書き出し・読み込み。機種変更やブラウザ移行時のバックアップに使えます。サーバーへの送信はありません。",
  alternates: {
    canonical: "/tools/data-transfer",
  },
};

export default function Page() {
  return <ClientOnly />;
}
