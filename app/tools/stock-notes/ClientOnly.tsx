"use client";

import dynamic from "next/dynamic";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly() {
  return <ToolClient />;
}
