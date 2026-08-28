export type RelationCategory = "capital" | "control" | "historical";
export type VerificationStatus = "proposed" | "verified" | "rejected" | "superseded";
export type Confidence = "high" | "medium" | "low";

export type CompanyNetworkCompany = {
  id: string;
  name: string;
  countryCode: string | null;
  listingStatus: string;
  status: string;
};

export type CompanyRelationship = {
  relationId: string;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  relationCategory: RelationCategory;
  relationType: string;
  ownershipPct: number | null;
  votingRightsPct: number | null;
  isConsolidated: boolean | null;
  note: string;
  verificationStatus: VerificationStatus;
  confidence: Confidence;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceAsOf: string | null;
  checkedAt: string | null;
};

export type CompanyGroupMembership = {
  membershipId: string;
  companyId: string;
  companyName: string;
  groupId: string;
  groupSlug: string;
  groupName: string;
  groupType: string;
  membershipRole: string;
  membershipBasis: string;
  note: string;
  verificationStatus: VerificationStatus;
  confidence: Confidence;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceAsOf: string | null;
};

export type CompanyNetworkData = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
};

export type CompanyNetworkLoadResult =
  | { status: "ok"; data: CompanyNetworkData; message: null }
  | { status: "empty" | "error" | "unconfigured" | "unauthenticated"; data: CompanyNetworkData | null; message: string };
