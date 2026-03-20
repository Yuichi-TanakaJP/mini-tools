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
        }}
      >
        <div
          style={{
            border: "1px solid #ece7d8",
            borderRadius: 14,
            background: "#fffaf0",
            padding: "12px 14px",
            color: "#4b4434",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6b5b2d",
              marginBottom: 6,
            }}
          >
            このツールでできること
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            株主優待の銘柄ごとに、権利月やタグ、長期条件、関連リンクを
            スマホやPCにメモしておけます。
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.7 }}>
            失敗したことや次回の注意点も一緒に残せます。
          </p>
        </div>
      </section>
      <ClientOnly />
    </>
  );
}


