import type { Metadata } from "next";
import ClientOnly from "./ClientOnly";

export const metadata: Metadata = {
  title: "合計計算 | mini-tools",
  description:
    "数字を1行ずつ貼るだけで合計を計算。カンマ、円、マイナス表記にも対応し、入力内容は端末内に保存されます。",
  alternates: {
    canonical: "/tools/total",
  },
};

export default function Page() {
  return <ClientOnly />;
}
