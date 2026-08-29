export type RelationCategory = "capital" | "control" | "historical";
export type VerificationStatus = "proposed" | "verified" | "rejected" | "superseded";
export type Confidence = "high" | "medium" | "low";
export type CompanyNetworkNodeKind = "company" | "group";
export type CompanyNetworkScopeMode = "group" | "company";

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
  ticker: string | null;
  exchangeCode: string | null;
  exchangeName: string | null;
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

export type CompanyFunctionLink = {
  linkId: string;
  companyId: string;
  nodeId: string;
  functionSlug: string;
  functionName: string;
  classificationId: string | null;
  classificationSlug: string | null;
  classificationName: string | null;
  role: string;
  confidence: Confidence;
  sourceType: string | null;
  asOf: string | null;
  note: string;
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
  functions: CompanyFunctionLink[];
};

export type CompanyNetworkBootstrapData = {
  /** @deprecated group-first UIでは使用しない。互換性のため残す。 */
  entryCompanies: CompanyNetworkCompany[];
  groups: CompanyNetworkGroup[];
  /** @deprecated group-first UIでは使用しない。互換性のため残す。 */
  defaultCompanyId: string;
  defaultGroupId: string;
};

export type CompanyNetworkBootstrapResult =
  | { status: "ok"; data: CompanyNetworkBootstrapData; message: null }
  | { status: "empty" | "error" | "unconfigured" | "unauthenticated"; data: CompanyNetworkBootstrapData | null; message: string };

export type CompanyNetworkScopeResult =
  | { status: "ok" | "empty"; data: CompanyNetworkData; message: string | null }
  | { status: "error" | "unconfigured" | "unauthenticated"; data: null; message: string };
