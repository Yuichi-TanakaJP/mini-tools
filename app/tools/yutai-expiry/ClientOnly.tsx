"use client";

import dynamic from "next/dynamic";

type Props = { scanEnabled: boolean };

// scanEnabled は server component が cookie 検証して props で渡す前提なので、
// 共通の createClientOnlyTool は使わずインラインで dynamic 化する。
const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });
const DatabaseRewards = dynamic(() => import("./DatabaseRewards"), { ssr: false });

export default function ClientOnly(props: Props) {
  if (process.env.NEXT_PUBLIC_YUTAI_EXPIRY_DB_PREVIEW === "true") return <DatabaseRewards {...props} />;
  return <ToolClient {...props} />;
}
