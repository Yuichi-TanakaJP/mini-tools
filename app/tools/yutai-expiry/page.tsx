import type { Metadata } from "next";
import ShareButtons from "@/components/ShareButtonsSuspended";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "株主優待期限帳 | mini-tools",
  description:
    "株主優待の有効期限を端末内で管理。今月の未使用を基本表示（完了はトグル）。カード/表の切替対応。",
};

export default function Page() {
  return (
    <main
      style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 96px" }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>株主優待リスト</h1>
        <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.6 }}>
          優待の期限を管理するツールです。
          <br />
          データは自分のPC、スマホに保存されます。
          <br />
        </p>
      </header>

      <ToolClient />

      <footer
        style={{ marginTop: 18, display: "flex", justifyContent: "center" }}
      >
        <ShareButtons text="株主優待期限帳：今月の未使用が一瞬で見える（カード/表切替・完了トグル）" />
      </footer>
    </main>
  );
}
