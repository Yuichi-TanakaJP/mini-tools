import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyGroupMembership,
  CompanyNetworkBootstrapResult,
  CompanyNetworkCompany,
  CompanyNetworkData,
  CompanyNetworkGroup,
  CompanyNetworkScopeResult,
  CompanyRelationship,
  Confidence,
  RelationCategory,
  VerificationStatus,
} from "./types";

const ROW_LIMIT = 2000;
const RELATION_CATEGORIES: readonly string[] = ["capital", "control", "historical"];
const VERIFICATION_STATUSES: readonly string[] = ["proposed", "verified", "rejected", "superseded"];
const CONFIDENCES: readonly string[] = ["high", "medium", "low"];
const COMPANY_SELECT = "id,display_name,country_code,listing_status,status";
const MEMBERSHIP_SELECT =
  "membership_id,company_entity_id,company_name,group_id,group_slug,group_name,group_type," +
  "membership_role,membership_basis,relation_note,verification_status,confidence," +
  "source_title,source_url,source_type,source_as_of,valid_to";

type Row = Record<string, unknown>;

function stringValue(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableString(row: Row, key: string): string | null {
  const value = stringValue(row, key).trim();
  return value.length > 0 ? value : null;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableBoolean(row: Row, key: string): boolean | null {
  const value = row[key];
  return typeof value === "boolean" ? value : null;
}

function oneOf<T extends string>(row: Row, key: string, allowed: readonly string[]): T | null {
  const value = stringValue(row, key);
  return allowed.includes(value) ? (value as T) : null;
}

function parseCompany(row: Row): CompanyNetworkCompany | null {
  const id = nullableString(row, "id");
  const name = nullableString(row, "display_name");
  if (!id || !name) return null;
  return {
    id,
    name,
    countryCode: nullableString(row, "country_code"),
    listingStatus: stringValue(row, "listing_status"),
    status: stringValue(row, "status"),
  };
}

function parseRelationship(row: Row): CompanyRelationship | null {
  const relationId = nullableString(row, "relation_id");
  const sourceCompanyId = nullableString(row, "source_company_id");
  const sourceCompanyName = nullableString(row, "source_company_name");
  const targetCompanyId = nullableString(row, "target_company_id");
  const targetCompanyName = nullableString(row, "target_company_name");
  const relationCategory = oneOf<RelationCategory>(row, "relation_category", RELATION_CATEGORIES);
  const verificationStatus = oneOf<VerificationStatus>(row, "verification_status", VERIFICATION_STATUSES);
  const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
  if (
    !relationId || !sourceCompanyId || !sourceCompanyName || !targetCompanyId || !targetCompanyName ||
    !relationCategory || !verificationStatus || !confidence
  ) return null;

  return {
    relationId,
    sourceCompanyId,
    sourceCompanyName,
    targetCompanyId,
    targetCompanyName,
    relationCategory,
    relationType: stringValue(row, "relation_type"),
    ownershipPct: nullableNumber(row, "ownership_pct"),
    votingRightsPct: nullableNumber(row, "voting_rights_pct"),
    isConsolidated: nullableBoolean(row, "is_consolidated"),
    note: stringValue(row, "relation_note"),
    verificationStatus,
    confidence,
    sourceTitle: nullableString(row, "source_title"),
    sourceUrl: nullableString(row, "source_url"),
    sourceType: nullableString(row, "source_type"),
    sourceAsOf: nullableString(row, "source_as_of"),
    checkedAt: nullableString(row, "checked_at"),
  };
}

function parseMembership(row: Row): CompanyGroupMembership | null {
  const membershipId = nullableString(row, "membership_id");
  const companyId = nullableString(row, "company_entity_id");
  const companyName = nullableString(row, "company_name");
  const groupId = nullableString(row, "group_id");
  const groupName = nullableString(row, "group_name");
  const verificationStatus = oneOf<VerificationStatus>(row, "verification_status", VERIFICATION_STATUSES);
  const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
  if (!membershipId || !companyId || !companyName || !groupId || !groupName || !verificationStatus || !confidence) return null;

  return {
    membershipId,
    companyId,
    companyName,
    groupId,
    groupSlug: stringValue(row, "group_slug"),
    groupName,
    groupType: stringValue(row, "group_type"),
    membershipRole: stringValue(row, "membership_role"),
    membershipBasis: stringValue(row, "membership_basis"),
    note: stringValue(row, "relation_note"),
    verificationStatus,
    confidence,
    sourceTitle: nullableString(row, "source_title"),
    sourceUrl: nullableString(row, "source_url"),
    sourceType: nullableString(row, "source_type"),
    sourceAsOf: nullableString(row, "source_as_of"),
  };
}

function parseGroup(row: Row): CompanyNetworkGroup | null {
  const id = nullableString(row, "id");
  const name = nullableString(row, "display_name");
  if (!id || !name) return null;
  return { id, name, groupType: stringValue(row, "group_type") };
}

export function companyNetworkUnconfigured(): CompanyNetworkBootstrapResult {
  return { status: "unconfigured", data: null, message: "Supabase 連携が未設定のため企業関係マップを取得できません。" };
}

export function companyNetworkAuthRequired(): CompanyNetworkBootstrapResult {
  return { status: "unauthenticated", data: null, message: "Supabase にログインすると、保存済みの企業関係マップを表示します。" };
}

export async function loadCompanyNetworkBootstrap(supabase: SupabaseClient): Promise<CompanyNetworkBootstrapResult> {
  const [listedResult, outboundResult, groupsResult] = await Promise.all([
    supabase
      .from("stock_notes_company_entities")
      .select(COMPANY_SELECT)
      .eq("listing_status", "domestic_listed")
      .neq("status", "archived")
      .order("display_name", { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_company_relationship_edges_v")
      .select("source_company_id")
      .is("valid_to", null)
      .in("verification_status", ["verified", "proposed"])
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_corporate_groups")
      .select("id,display_name,group_type")
      .eq("status", "active")
      .is("valid_to", null)
      .in("verification_status", ["verified", "proposed"])
      .order("display_name", { ascending: true })
      .limit(ROW_LIMIT),
  ]);

  if (listedResult.error || outboundResult.error || groupsResult.error) {
    return { status: "error", data: null, message: "企業関係マップの入口一覧を取得できませんでした。" };
  }

  const listed = ((listedResult.data ?? []) as unknown as Row[]).map(parseCompany).filter((row): row is CompanyNetworkCompany => row !== null);
  const listedIds = new Set(listed.map((company) => company.id));
  const outboundIds = [...new Set(((outboundResult.data ?? []) as unknown as Row[]).map((row) => nullableString(row, "source_company_id")).filter((id): id is string => Boolean(id)))];
  const missingOutboundIds = outboundIds.filter((id) => !listedIds.has(id));

  let outboundCompanies: CompanyNetworkCompany[] = [];
  if (missingOutboundIds.length > 0) {
    const outboundCompaniesResult = await supabase
      .from("stock_notes_company_entities")
      .select(COMPANY_SELECT)
      .in("id", missingOutboundIds)
      .neq("status", "archived")
      .order("display_name", { ascending: true });
    if (outboundCompaniesResult.error) {
      return { status: "error", data: null, message: "中心企業候補を取得できませんでした。" };
    }
    outboundCompanies = ((outboundCompaniesResult.data ?? []) as unknown as Row[]).map(parseCompany).filter((row): row is CompanyNetworkCompany => row !== null);
  }

  const entryCompanies = [...listed, ...outboundCompanies]
    .filter((company, index, rows) => rows.findIndex((row) => row.id === company.id) === index)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const groups = ((groupsResult.data ?? []) as unknown as Row[]).map(parseGroup).filter((row): row is CompanyNetworkGroup => row !== null);

  if (entryCompanies.length === 0) {
    return { status: "empty", data: { entryCompanies: [], groups, defaultCompanyId: "" }, message: "中心企業候補がまだありません。" };
  }

  const defaultCompanyId = entryCompanies.find((company) => company.name === "トヨタ自動車")?.id ?? entryCompanies[0].id;
  return { status: "ok", data: { entryCompanies, groups, defaultCompanyId }, message: null };
}

export async function loadCompanyNetworkScope(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    hops: 1 | 2;
    verifiedOnly: boolean;
    categories: RelationCategory[];
    includeGroups: boolean;
  },
): Promise<CompanyNetworkScopeResult> {
  const statuses = options.verifiedOnly ? ["verified"] : ["verified", "proposed"];
  const networkResult = await supabase.rpc("stock_notes_company_network", {
    p_company_id: options.companyId,
    p_max_hops: options.hops,
    p_verified_only: options.verifiedOnly,
    p_active_only: true,
    p_relation_categories: options.categories.length > 0 ? options.categories : null,
  });

  if (networkResult.error) {
    return { status: "error", data: null, message: "選択企業の企業間関係を取得できませんでした。" };
  }

  const relationships = ((networkResult.data ?? []) as unknown as Row[])
    .map(parseRelationship)
    .filter((row): row is CompanyRelationship => row !== null);

  const centerMembershipResult = await supabase
    .from("stock_notes_company_group_memberships_v")
    .select(MEMBERSHIP_SELECT)
    .eq("company_entity_id", options.companyId)
    .is("valid_to", null)
    .in("verification_status", statuses)
    .limit(ROW_LIMIT);

  if (centerMembershipResult.error) {
    return { status: "error", data: null, message: "選択企業のグループ所属を取得できませんでした。" };
  }

  const centerMemberships = ((centerMembershipResult.data ?? []) as unknown as Row[])
    .map(parseMembership)
    .filter((row): row is CompanyGroupMembership => row !== null);
  const groupIds = [...new Set(centerMemberships.map((membership) => membership.groupId))];

  let memberships = centerMemberships;
  if (options.includeGroups && groupIds.length > 0) {
    const groupMembershipResult = await supabase
      .from("stock_notes_company_group_memberships_v")
      .select(MEMBERSHIP_SELECT)
      .in("group_id", groupIds)
      .is("valid_to", null)
      .in("verification_status", statuses)
      .order("company_name", { ascending: true })
      .limit(ROW_LIMIT);
    if (groupMembershipResult.error) {
      return { status: "error", data: null, message: "所属グループの企業一覧を取得できませんでした。" };
    }
    memberships = ((groupMembershipResult.data ?? []) as unknown as Row[])
      .map(parseMembership)
      .filter((row): row is CompanyGroupMembership => row !== null);
  }

  const companyIds = new Set<string>([options.companyId]);
  relationships.forEach((relationship) => {
    companyIds.add(relationship.sourceCompanyId);
    companyIds.add(relationship.targetCompanyId);
  });
  memberships.forEach((membership) => companyIds.add(membership.companyId));

  const companiesResult = await supabase
    .from("stock_notes_company_entities")
    .select(COMPANY_SELECT)
    .in("id", [...companyIds])
    .neq("status", "archived")
    .order("display_name", { ascending: true });

  if (companiesResult.error) {
    return { status: "error", data: null, message: "表示対象企業の情報を取得できませんでした。" };
  }

  const companies = ((companiesResult.data ?? []) as unknown as Row[])
    .map(parseCompany)
    .filter((row): row is CompanyNetworkCompany => row !== null);
  const data: CompanyNetworkData = { companies, relationships, memberships };
  const empty = relationships.length === 0 && memberships.length === 0;
  return { status: empty ? "empty" : "ok", data, message: empty ? "この企業には現在の条件で表示できる関係がありません。" : null };
}
