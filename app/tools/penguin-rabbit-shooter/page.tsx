import type { Metadata } from "next";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "ペンギン・エイリアンシューター | mini-tools",
  description:
    "宇宙船に乗ったペンギンを操縦してエイリアンを撃つ、絵文字ベースのミニシューティングゲーム。",
  alternates: {
    canonical: "/tools/penguin-rabbit-shooter",
  },
};

export default function Page() {
  return <ToolClient />;
}
