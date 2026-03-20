import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "文字数カウント | mini-tools",
  description:
    "X投稿や note 下書きの文字数を確認。140/280 の残り、スペース・改行除外文字数、X推定文字数も表示できます。",
  alternates: {
    canonical: "/tools/charcount",
  },
};

export default function Page() {
  return <ClientOnly />;
}
