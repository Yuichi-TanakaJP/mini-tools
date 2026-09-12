import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIBLE_STATES,
  MARKET_DATA_FLOW,
  MARKET_DATA_TOUCHPOINTS,
  SYSTEM_CONTEXT_EDGES,
  SYSTEM_CONTEXT_NODES,
  filterEdgesByStates,
  nodesByLayer,
  orderedFlow,
} from "./model";

describe("system map model", () => {
  it("keeps approved proposed edges out of the default Current view", () => {
    const visible = filterEdgesByStates(SYSTEM_CONTEXT_EDGES, DEFAULT_VISIBLE_STATES);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.some((edge) => edge.state === "approved_proposed")).toBe(false);
    expect(visible.some((edge) => edge.id === "health-workspace")).toBe(false);
  });

  it("keeps access surface and execution locus as separate fields", () => {
    const chatgpt = SYSTEM_CONTEXT_NODES.find((node) => node.id === "chatgpt");
    const marketInfo = SYSTEM_CONTEXT_NODES.find((node) => node.id === "market-info");

    expect(chatgpt?.accessSurfaces).toContain("Smartphone app");
    expect(chatgpt?.executionLocus).toBe("hosted AI runtime");
    expect(marketInfo?.accessSurfaces).toContain("Windows PowerShell");
    expect(marketInfo?.executionLocus).toBe("local Windows PC");
  });

  it("places every context node into a known layer", () => {
    const grouped = nodesByLayer(SYSTEM_CONTEXT_NODES);
    const total = [...grouped.values()].reduce((sum, nodes) => sum + nodes.length, 0);

    expect(total).toBe(SYSTEM_CONTEXT_NODES.length);
    expect(grouped.get("access")?.map((node) => node.id)).toContain("user");
    expect(grouped.get("data")?.map((node) => node.id)).toContain("workspace-core");
  });

  it("keeps the Market Data flow deterministic from user to viewing surface", () => {
    const ordered = orderedFlow([...MARKET_DATA_FLOW].reverse());

    expect(ordered.map((step) => step.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ordered[0]?.id).toBe("md-user");
    expect(ordered.at(-1)?.id).toBe("md-view");
  });

  it("uses the four improvement classifications without silently treating all manual work as automation debt", () => {
    expect(new Set(MARKET_DATA_TOUCHPOINTS.map((item) => item.opportunity))).toEqual(
      new Set(["keep-human", "ai-assist", "automate", "needs-investigation"]),
    );
  });
});
