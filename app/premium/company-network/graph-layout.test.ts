import { describe, expect, it } from "vitest";
import { buildSeriesRows, seedSimNodes } from "./graph-layout";
import type { CompanyRelationship } from "./types";

function relationship(
  relationId: string,
  sourceCompanyId: string,
  targetCompanyId: string,
  overrides: Partial<CompanyRelationship> = {},
): CompanyRelationship {
  return {
    relationId,
    sourceCompanyId,
    sourceCompanyName: sourceCompanyId,
    targetCompanyId,
    targetCompanyName: targetCompanyId,
    relationCategory: "capital",
    relationType: "equity_ownership",
    ownershipPct: null,
    votingRightsPct: null,
    isConsolidated: null,
    note: "",
    verificationStatus: "verified",
    confidence: "high",
    sourceTitle: null,
    sourceUrl: null,
    sourceType: null,
    sourceAsOf: null,
    checkedAt: null,
    ...overrides,
  };
}

describe("company-network graph layout", () => {
  it("force初期配置は同じ入力から決定的に作られる", () => {
    const nodes = [
      { id: "a", label: "A", kind: "company" as const },
      { id: "b", label: "B", kind: "company" as const },
      { id: "g", label: "Group", kind: "group" as const },
    ];
    expect(seedSimNodes(nodes, 200)).toEqual(seedSimNodes(nodes, 200));
  });

  it("系列ビューはcanonical directionを保って上位と下位を分ける", () => {
    const result = buildSeriesRows({
      selectedCompanyId: "woven",
      selectedCompanyName: "Woven",
      maxDepth: 2,
      relationships: [
        relationship("toyota-woven", "toyota", "woven", { ownershipPct: 100 }),
        relationship("woven-child", "woven", "child", { relationType: "controls", relationCategory: "control" }),
        relationship("history", "old", "woven", { relationType: "predecessor_of", relationCategory: "historical" }),
      ],
    });

    expect(result.upstream.map((row) => row.companyId)).toEqual(["toyota"]);
    expect(result.downstream.map((row) => row.companyId)).toEqual(["child"]);
    expect(result.upstream.some((row) => row.companyId === "old")).toBe(false);
  });
});
