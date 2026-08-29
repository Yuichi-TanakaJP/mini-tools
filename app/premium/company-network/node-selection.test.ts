import { describe, expect, it } from "vitest";
import { buildSelectedNeighbourIds, groupGraphNodeId, selectedGraphNodeId } from "./node-selection";
import type { CompanyGroupMembership, CompanyRelationship } from "./types";

const relationships: CompanyRelationship[] = [
  {
    relationId: "toyota-woven",
    sourceCompanyId: "toyota",
    sourceCompanyName: "Toyota",
    targetCompanyId: "woven",
    targetCompanyName: "Woven",
    relationCategory: "capital",
    relationType: "equity_ownership",
    ownershipPct: 100,
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
  },
];

const memberships: CompanyGroupMembership[] = [
  {
    membershipId: "m-toyota",
    companyId: "toyota",
    companyName: "Toyota",
    groupId: "toyota-group",
    groupSlug: "toyota-group",
    groupName: "Toyota Group",
    groupType: "corporate_group",
    membershipRole: "core",
    membershipBasis: "official_group_member",
    note: "",
    verificationStatus: "verified",
    confidence: "high",
    sourceTitle: null,
    sourceUrl: null,
    sourceType: null,
    sourceAsOf: null,
  },
  {
    membershipId: "m-woven",
    companyId: "woven",
    companyName: "Woven",
    groupId: "toyota-group",
    groupSlug: "toyota-group",
    groupName: "Toyota Group",
    groupType: "corporate_group",
    membershipRole: "member",
    membershipBasis: "official_group_member",
    note: "",
    verificationStatus: "verified",
    confidence: "high",
    sourceTitle: null,
    sourceUrl: null,
    sourceType: null,
    sourceAsOf: null,
  },
];

describe("company-network node selection", () => {
  it("company selection highlights direct companies and its groups", () => {
    const ids = buildSelectedNeighbourIds({ kind: "company", id: "toyota" }, relationships, memberships);
    expect([...ids ?? []].sort()).toEqual([groupGraphNodeId("toyota-group"), "toyota", "woven"].sort());
  });

  it("group selection highlights every visible member without changing the center", () => {
    const ids = buildSelectedNeighbourIds({ kind: "group", id: "toyota-group" }, relationships, memberships);
    expect([...ids ?? []].sort()).toEqual([groupGraphNodeId("toyota-group"), "toyota", "woven"].sort());
    expect(selectedGraphNodeId({ kind: "group", id: "toyota-group" })).toBe(groupGraphNodeId("toyota-group"));
  });
});
