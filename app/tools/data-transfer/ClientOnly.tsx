"use client";

import { createClientOnlyTool } from "@/components/createClientOnlyTool";

const ClientOnly = createClientOnlyTool(() => import("./ToolClient"));

export default ClientOnly;
