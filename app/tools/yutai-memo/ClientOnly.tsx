"use client";

import dynamic from "next/dynamic";
import RouteLoading from "@/components/navigation/RouteLoading";
import type { NikkoShortBalanceData } from "./types";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false, loading: () => <RouteLoading label="ツール" /> });

export default function ClientOnly({
  shortBalance,
}: {
  shortBalance: NikkoShortBalanceData;
}) {
  return <ToolClient shortBalance={shortBalance} />;
}
