import type { Metadata } from "next";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "ペンギン・バニーシューター | mini-tools",
  description:
    "宇宙船に乗ったペンギンを操縦してうさぎを撃つ、絵文字ベースのミニシューティングゲーム。",
  alternates: {
    canonical: "/tools/penguin-rabbit-shooter",
  },
};

export default function Page() {
  return <ToolClient />;
}
