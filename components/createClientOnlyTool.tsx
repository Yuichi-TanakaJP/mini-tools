"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";

type ToolClientModule = {
  default: ComponentType;
};

export function createClientOnlyTool(
  loader: () => Promise<ToolClientModule>,
) {
  const ToolClient = dynamic(loader, { ssr: false });

  return function ClientOnlyTool() {
    return <ToolClient />;
  };
}
