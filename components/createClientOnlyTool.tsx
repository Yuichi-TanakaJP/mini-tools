"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import RouteLoading from "@/components/navigation/RouteLoading";

type ToolClientModule = {
  default: ComponentType;
};

export function createClientOnlyTool(
  loader: () => Promise<ToolClientModule>,
) {
  const ToolClient = dynamic(loader, { ssr: false, loading: () => <RouteLoading label="ツール" /> });

  return function ClientOnlyTool() {
    return <ToolClient />;
  };
}
