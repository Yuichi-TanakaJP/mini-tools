"use client";

import dynamic from "next/dynamic";
import RouteLoading from "@/components/navigation/RouteLoading";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false, loading: () => <RouteLoading label="ツール" /> });

export default function ClientOnly() {
  return <ToolClient />;
}
