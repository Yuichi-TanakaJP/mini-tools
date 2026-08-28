import { describe, expect, it } from "vitest";
import { buildEntryCompanies } from "./entry-companies";
import type { CompanyNetworkCompany, CompanyRelationship } from "./types";

const companies: CompanyNetworkCompany[] = [
  { id: "toyota", name: "トヨタ自動車", countryCode: "JP", listingStatus: "domestic_listed", status: "active" },
  { id: "woven", name: "ウーブン・バイ・トヨタ", countryCode: "JP", listingStatus: "private", status: "active" },
  { id: "denso", name: "デンソー", countryCode: "JP", listingStatus: "domestic_listed", status: "active" },
  { id: "private-parent", name: "非上場親会社", countryCode: "JP", listingStatus: "private", status: "active" },
];

const relationships = [
  {
    relationId: "r1",
    sourceCompanyId: "toyota",
    sourceCompanyName: "トヨタ自動車",
    targetCompanyId: "woven",
    targetCompanyName: "ウーブン・バイ・トヨタ",
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
  {
    relationId: "r2",
    sourceCompanyId: "private-parent",
    sourceCompanyName: "非上場親会社",
    targetCompanyId: "woven",
    targetCompanyName: "ウーブン・バイ・トヨタ",
    relationCategory: "control",
    relationType: "controls",
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
  },
] satisfies CompanyRelationship[];

describe("buildEntryCompanies", () => {
  it("keeps listed companies and outbound relationship sources as entry candidates", () => {
    expect(buildEntryCompanies(companies, relationships).map((company) => company.id)).toEqual([
      "toyota",
      "denso",
      "private-parent",
    ]);
  });

  it("does not promote a private target-only company to the entry selector", () => {
    expect(buildEntryCompanies(companies, relationships).some((company) => company.id === "woven")).toBe(false);
  });
});
