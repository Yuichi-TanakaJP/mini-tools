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

  return <ToolClient data={data} manifest={manifest} currentDate={date} />;
}
