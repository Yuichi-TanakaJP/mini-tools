import type { Metadata } from "next";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "ペンギン・バニーシューター | mini-tools",
  description:
    "ペンギンを動かしてうさぎを撃つ、絵文字ベースのミニシューティングゲーム。",
  alternates: {
    canonical: "/tools/penguin-rabbit-shooter",
  },
};

export default function Page() {
  return <ToolClient />;
}
