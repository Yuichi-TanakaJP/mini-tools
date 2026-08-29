export type RelationCategory = "capital" | "control" | "historical";
export type VerificationStatus = "proposed" | "verified" | "rejected" | "superseded";
export type Confidence = "high" | "medium" | "low";
export type CompanyNetworkNodeKind = "company" | "group";

export type CompanyNetworkNodeSelection = {
  kind: CompanyNetworkNodeKind;
  id: string;
};

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

export type CompanyNetworkGroup = {
  id: string;
  name: string;
  groupType: string;
};

export type CompanyNetworkData = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
};

export type CompanyNetworkBootstrapData = {
  entryCompanies: CompanyNetworkCompany[];
  groups: CompanyNetworkGroup[];
  defaultCompanyId: string;
};

export type CompanyNetworkBootstrapResult =
  | { status: "ok"; data: CompanyNetworkBootstrapData; message: null }
  | { status: "empty" | "error" | "unconfigured" | "unauthenticated"; data: CompanyNetworkBootstrapData | null; message: string };

export type CompanyNetworkScopeResult =
  | { status: "ok" | "empty"; data: CompanyNetworkData; message: string | null }
  | { status: "error" | "unconfigured" | "unauthenticated"; data: null; message: string };
