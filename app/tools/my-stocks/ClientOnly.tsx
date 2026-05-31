"use client";

import dynamic from "next/dynamic";
import type { MyStocksReference } from "./types";

const ToolClient = dynamic(() => import("./ToolClient"), { ssr: false });

export default function ClientOnly({ reference }: { reference: MyStocksReference }) {
  return <ToolClient reference={reference} />;
}
