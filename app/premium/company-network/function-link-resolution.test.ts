import { describe, expect, it } from "vitest";
import { mergeFunctionLinks } from "./function-link-resolution";
import type { CompanyFunctionLink } from "./types";

function link(
  linkId: string,
  companyId: string,
  nodeId: string,
  overrides: Partial<CompanyFunctionLink> = {},
): CompanyFunctionLink {
  return {
    linkId,
    companyId,
    nodeId,
    functionSlug: nodeId,
    functionName: nodeId,
    classificationId: "class",
    classificationSlug: "class",
    classificationName: "分類",
    role: "supporting",
    confidence: "medium",
    sourceType: "manual",
    asOf: null,
    note: "",
    ...overrides,
  };
}

describe("company function link resolution", () => {
  it("同一企業・同一機能ではdirect linkをderivedより優先する", () => {
    const direct = link("direct", "sony", "games", { role: "supporting", confidence: "medium" });
    const derived = link("derived:source:games", "sony", "games", { role: "core", confidence: "high" });

    expect(mergeFunctionLinks([direct], [derived])).toEqual([direct]);
  });

  it("derived同士が競合した場合はconfidence、次にroleの強い根拠を選ぶ", () => {
    const mediumCore = link("b", "sony", "sensor", { confidence: "medium", role: "core" });
    const highSupporting = link("c", "sony", "sensor", { confidence: "high", role: "supporting" });
    const highCore = link("a", "sony", "sensor", { confidence: "high", role: "core" });

    expect(mergeFunctionLinks([], [mediumCore, highSupporting, highCore])).toEqual([highCore]);
  });

  it("異なる機能は保持する", () => {
    const music = link("music", "sony", "music");
    const anime = link("anime", "sony", "anime");

    expect(mergeFunctionLinks([music], [anime])).toHaveLength(2);
  });
});
