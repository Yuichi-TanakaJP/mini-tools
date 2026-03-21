import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "X投稿文字数カウント | mini-tools",
  description:
    "X投稿文を貼るだけで、140字に収まるかを確認できる文字数カウントツール。X推定文字数、残り140字、通常文字数も表示できます。",
  alternates: {
    canonical: "/tools/charcount",
  },
};

export default function Page() {
  return <ClientOnly />;
}
