import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "マイ銘柄リスト | mini-tools",
  description:
    "保有情報はPortfolio、ウォッチは銘柄分析ダッシュボードへ集約しました。",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/tools/my-stocks",
  },
};

export default function Page() {
  return <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
    <h1>マイ銘柄リストは統合しました</h1>
    <p>保有の二重入力は不要です。既存のPortfolioを参照し、ウォッチは銘柄分析で管理します。</p>
    <p><Link href="/premium/portfolio">保有一覧・全体方針を見る（Portfolio） →</Link></p>
    <p><Link href="/tools/stock-notes">銘柄分析・ウォッチを開く →</Link></p>
    <p>旧端末データとメモは自動移行しません。PortfolioへのCSV再取込は必要ありません。</p>
  </main>;
}
