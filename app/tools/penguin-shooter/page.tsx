import type { Metadata } from "next";
import ToolClient from "./ToolClient";

export const metadata: Metadata = {
  title: "ペンギンシューター | mini-tools",
  description:
    "宇宙船Shutyに乗ったPenを操作して、捕まったShootの救出を目指すミニシューティングゲーム。",
  alternates: {
    canonical: "/tools/penguin-shooter",
  },
};

export default function Page() {
  return <ToolClient />;
}
