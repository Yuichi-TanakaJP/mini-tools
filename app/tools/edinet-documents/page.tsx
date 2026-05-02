import type { Metadata } from "next";
import ToolClient from "./ToolClient";
import { loadEdinetDocumentList, loadEdinetManifest } from "./data-loader";

export const metadata: Metadata = {
  title: "EDINET書類一覧 | mini-tools",
  description:
    "金融庁EDINETに提出された有価証券報告書などの書類を日次で確認できるツール。",
  alternates: {
    canonical: "/tools/edinet-documents",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  const [manifest, data] = await Promise.all([
    loadEdinetManifest(),
    loadEdinetDocumentList(date),
  ]);

  if (!data) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 64px" }}>
        <section style={{ padding: "32px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>📄</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
              EDINET書類一覧
            </h1>
          </div>
        </section>
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: 14,
          }}
        >
          データを取得できませんでした。時間をおいて再度お試しください。
        </div>
      </main>
    );
  }

  return <ToolClient data={data} manifest={manifest} />;
}
