import type { Metadata } from "next";
import ShareButtons from "@/components/ShareButtonsSuspended";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "株主優待期限帳 | mini-tools",
  description:
    "株主優待の有効期限を端末内で管理。今月の未使用を基本表示（完了はトグル）。カード/表の切替対応。",
  alternates: {
    canonical: "/tools/yutai-expiry",
  },
};

export default function Page() {
  return (
    <main
      style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px 96px" }}
    >
      <ClientOnly />

      <footer
        style={{
          marginTop: 22,
          display: "flex",
          justifyContent: "center",
          paddingTop: 12,
        }}
      >
        <ShareButtons text="株主優待期限帳：今月の未使用が一瞬で見える（PC向け：カード/表）" />
      </footer>
    </main>
  );
}
