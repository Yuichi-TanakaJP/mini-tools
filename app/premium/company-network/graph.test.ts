import { describe, expect, it } from "vitest";
import { buildReachableNetwork } from "./graph";
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

const edges = [
  relationship("ab", "a", "b"),
  relationship("bc", "b", "c"),
  relationship("ca", "c", "a", { relationCategory: "historical" }),
  relationship("bd", "b", "d", { verificationStatus: "proposed" }),
];

describe("buildReachableNetwork", () => {
  it("1-hopでは中心企業に直接接続する企業だけを採る", () => {
    const result = buildReachableNetwork({
      selectedCompanyId: "a",
      relationships: edges,
      hops: 1,
      categories: ["capital"],
      verifiedOnly: true,
    });

    expect([...result.depthByCompany.entries()]).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(result.relationships.map((edge) => edge.relationId)).toEqual(["ab"]);
  });

  it("2-hopで二段先を含め、循環しても中心へ戻らない", () => {
    const result = buildReachableNetwork({
      selectedCompanyId: "a",
      relationships: edges,
      hops: 2,
      categories: ["capital", "historical"],
      verifiedOnly: true,
    });

    expect(result.depthByCompany.get("b")).toBe(1);
    expect(result.depthByCompany.get("c")).toBe(1);
    expect(result.depthByCompany.size).toBe(3);
    expect(new Set(result.relationships.map((edge) => edge.relationId))).toEqual(
      new Set(["ab", "bc", "ca"]),
    );
  });

  it("verifiedOnly=falseならproposedも探索に使う", () => {
    const result = buildReachableNetwork({
      selectedCompanyId: "a",
      relationships: edges,
      hops: 2,
      categories: ["capital"],
      verifiedOnly: false,
    });

    expect(result.depthByCompany.get("d")).toBe(2);
    expect(result.relationships.some((edge) => edge.relationId === "bd")).toBe(true);
  });
});
