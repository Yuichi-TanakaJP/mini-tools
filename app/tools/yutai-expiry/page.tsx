import type { Metadata } from "next";
import ShareButtons from "@/components/ShareButtons";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "株主優待期限帳 | mini-tools",
  description:
    "株主優待の有効期限を端末内で管理。未使用/使用済み、期限が近い順、月別表示、ソート対応。",
};

export default function Page() {
  return (
    <main
      style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 80px" }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>株主優待期限帳</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          取得した優待の「使える最終日」を管理。未使用/使用済み、期限が近い順、月別表示。
          <br />
          データは端末内（localStorage）に保存されます。
        </p>
        <div style={{ marginTop: 12 }}>
          <ShareButtons text="株主優待期限帳：優待の有効期限を管理（未使用/使用済み・期限順・月別）" />
        </div>
      </header>

      <ToolClient />
    </main>
  );
}
