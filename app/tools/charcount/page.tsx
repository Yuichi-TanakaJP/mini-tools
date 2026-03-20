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
  return (
    <>
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "16px 16px 0",
          color: "#444",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
          X投稿や note 下書きの文字数確認に使えるツールです。通常文字数、
          スペース・改行除外文字数、X推定文字数を確認でき、入力内容は端末内に保存されます。
        </p>
      </section>
      <ClientOnly />
    </>
  );
}
