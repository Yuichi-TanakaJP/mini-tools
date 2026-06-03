"use client";

import dynamic from "next/dynamic";
import type { NikkoShortBalanceData } from "./types";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly({
  shortBalance,
}: {
  shortBalance: NikkoShortBalanceData;
}) {
  return <ToolClient shortBalance={shortBalance} />;
}
