"use client";

import dynamic from "next/dynamic";

type Props = { scanEnabled: boolean };

// scanEnabled は server component が cookie 検証して props で渡す前提なので、
// 共通の createClientOnlyTool は使わずインラインで dynamic 化する。
const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly(props: Props) {
  return <ToolClient {...props} />;
}
