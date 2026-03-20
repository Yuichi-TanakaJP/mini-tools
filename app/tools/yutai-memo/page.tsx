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
          株主優待の銘柄メモ、権利月、タグ、長期条件、失敗ログ、関連リンクを端末内で管理できる優待メモツールです。
        </p>
      </section>
      <ClientOnly />
    </>
  );
}


